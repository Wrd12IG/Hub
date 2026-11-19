import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sellbird_firecrawl.client import (  # noqa: E402
    FirecrawlClient, FirecrawlError, OutOfCredits, TermsRequired, parse_decision_maker,
)

KEY = "fc-segretissima-1234567890"


class Resp:
    def __init__(self, status=200, body=None):
        self.status_code, self._body = status, body

    @property
    def content(self):
        return b"x" if self._body is not None else b""

    def json(self):
        return self._body


class FakeHttp:
    def __init__(self, *responses):
        self.responses, self.calls = list(responses), []

    async def post(self, url, json=None, headers=None):
        self.calls.append(("POST", url, json, headers))
        return self.responses.pop(0)

    async def get(self, url, headers=None):
        self.calls.append(("GET", url, None, headers))
        return self.responses.pop(0)


def entry(**data):
    base = {"email_status": "valid", "email": "paolo@esempio.it", "valid_email": "paolo@esempio.it", "person_first_name": "Paolo",
            "person_last_name": "Carmeli", "person_job_title": "CEO", "decision_maker_category": "ceo"}
    base.update(data)
    return {"provider": "anymailfinder", "data": base}


def ok(*entries):
    return Resp(200, {"success": True, "data": {"alexandria": list(entries)}})


class ParseTest(unittest.TestCase):
    def test_valid(self):
        dm = parse_decision_maker(entry(), "esempio.it")
        self.assertEqual((dm.first_name, dm.last_name, dm.title, dm.email, dm.category), ("Paolo", "Carmeli", "CEO", "paolo@esempio.it", "ceo"))

    def test_accepts_www_and_subdomain_mail(self):
        self.assertIsNotNone(parse_decision_maker(entry(), "www.esempio.it"))
        self.assertIsNotNone(parse_decision_maker(entry(valid_email="p@mail.esempio.it", email="p@mail.esempio.it"), "esempio.it"))

    def test_rejects_what_cannot_be_trusted(self):
        for bad in (
            entry(email_status="not_found"), entry(email_status="blacklisted"),
            entry(valid_email="paolo@altro.it", email="paolo@altro.it"),          # un altro dominio
            entry(valid_email="paolo@notesempio.it", email="paolo@notesempio.it"),  # suffisso, non sottodominio
            entry(valid_email="info@esempio.it", email="info@esempio.it"),          # casella di ruolo
            entry(valid_email="non-un-indirizzo", email="non-un-indirizzo"),
            entry(person_first_name="Pao1o"), entry(person_first_name=""), entry(person_last_name="12345"),
            {"data": {}}, {}, None,
        ):
            self.assertIsNone(parse_decision_maker(bad, "esempio.it"), bad)

    def test_full_name_fallback_and_accents(self):
        dm = parse_decision_maker(entry(person_first_name="", person_last_name="", person_full_name="Niccolò De Luca"), "esempio.it")
        self.assertEqual((dm.first_name, dm.last_name), ("Niccolò", "De Luca"))
        self.assertIsNotNone(parse_decision_maker(entry(person_last_name="D'Angelo"), "esempio.it"))


class ClientTest(unittest.IsolatedAsyncioTestCase):
    async def test_request_shape(self):
        http = FakeHttp(ok(entry()))
        dm = await FirecrawlClient(KEY, http=http).decision_maker("esempio.it", request_id="sb-1")
        self.assertEqual(dm.email, "paolo@esempio.it")
        method, url, body, headers = http.calls[0]
        self.assertEqual((method, url), ("POST", "https://api.firecrawl.dev/v2/scrape"))
        self.assertEqual(body["alexandria"], {"provider": "anymailfinder", "capability": "people/decision-maker",
                                              "options": {"decision_maker_category": ["ceo", "marketing"], "domain": "esempio.it"}})
        self.assertEqual(headers["Authorization"], f"Bearer {KEY}")
        self.assertEqual(headers["x-request-id"], "sb-1")

    async def test_not_found_and_empty(self):
        self.assertIsNone(await FirecrawlClient(KEY, http=FakeHttp(ok(entry(email_status="not_found")))).decision_maker("esempio.it"))
        self.assertIsNone(await FirecrawlClient(KEY, http=FakeHttp(ok())).decision_maker("esempio.it"))

    async def test_http_errors(self):
        async def err(status, body=None):
            with self.assertRaises(FirecrawlError) as cm:
                await FirecrawlClient(KEY, http=FakeHttp(Resp(status, body))).decision_maker("esempio.it")
            return cm.exception
        e = await err(401, {"error": "bad key"}); self.assertTrue(e.fatal)
        e = await err(403, {}); self.assertTrue(e.fatal)
        e = await err(402, {"error": "no credits"}); self.assertIsInstance(e, OutOfCredits); self.assertTrue(e.fatal)
        e = await err(429, {}); self.assertFalse(e.fatal)
        e = await err(500, {"error": "boom"}); self.assertFalse(e.fatal)

    async def test_terms_are_reported_never_accepted(self):
        body = {"success": False, "error": {"code": "THIRD_PARTY_DATA_TERMS_REQUIRED", "message": "accept",
                                            "requiresAction": {"url": "https://www.firecrawl.dev/app/settings?tab=data-sources"}}}
        with self.assertRaises(TermsRequired) as cm:
            await FirecrawlClient(KEY, http=FakeHttp(Resp(403, body))).decision_maker("esempio.it")
        self.assertTrue(cm.exception.fatal)
        self.assertIn("data-sources", cm.exception.url)

    async def test_error_inside_the_result_entry(self):
        with self.assertRaises(FirecrawlError):
            await FirecrawlClient(KEY, http=FakeHttp(ok({"error": "provider down"}))).decision_maker("esempio.it")

    async def test_key_never_appears_in_errors(self):
        with self.assertRaises(FirecrawlError) as cm:
            await FirecrawlClient(KEY, http=FakeHttp(Resp(500, {"error": f"bad token {KEY}"}))).decision_maker("esempio.it")
        self.assertNotIn(KEY, str(cm.exception))

    async def test_remaining_credits(self):
        http = FakeHttp(Resp(200, {"success": True, "data": {"remainingCredits": 3359, "planCredits": 5000}}))
        self.assertEqual(await FirecrawlClient(KEY, http=http).remaining_credits(), 3359)
        self.assertEqual(http.calls[0][:2], ("GET", "https://api.firecrawl.dev/v2/team/credit-usage"))
        with self.assertRaises(FirecrawlError):
            await FirecrawlClient(KEY, http=FakeHttp(Resp(200, {"data": {}}))).remaining_credits()

    def test_needs_a_key(self):
        with self.assertRaises(FirecrawlError):
            FirecrawlClient("", http=FakeHttp())


if __name__ == "__main__":
    unittest.main()
