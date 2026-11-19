import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sellbird_firecrawl import budget, settings  # noqa: E402

NOW = datetime(2026, 11, 19, 12, 0, tzinfo=timezone.utc)
LIM = budget.Limits(monthly=1000, daily=300, reserve=1500)


class BudgetTest(unittest.TestCase):
    def test_empty_and_corrupted(self):
        for raw in ("", "non json", "[]", "5", None):
            led = budget.load(raw, NOW)
            self.assertEqual((led["month"], led["day"], led["month_credits"], led["day_credits"]), ("2026-11", "2026-11-19", 0, 0))

    def test_rollover_resets_day_and_month_independently(self):
        raw = budget.dump({"month": "2026-11", "month_credits": 400, "day": "2026-11-18", "day_credits": 200, "calls": 5, "hits": 2})
        led = budget.load(raw, NOW)
        self.assertEqual((led["month_credits"], led["day_credits"]), (400, 0))      # nuovo giorno, stesso mese
        led = budget.load(raw, datetime(2026, 12, 1, tzinfo=timezone.utc))
        self.assertEqual((led["month_credits"], led["day_credits"]), (0, 0))        # nuovo mese

    def test_limits(self):
        led = budget.empty(NOW)
        self.assertEqual(budget.can_spend(led, LIM, 100, 3359), (True, ""))
        led["day_credits"] = 250
        self.assertFalse(budget.can_spend(led, LIM, 100, 3359)[0])                    # tetto giornaliero
        led = budget.empty(NOW); led["month_credits"] = 950
        self.assertIn("mensile", budget.can_spend(led, LIM, 100, 3359)[1])
        led = budget.empty(NOW)
        self.assertFalse(budget.can_spend(led, LIM, 100, 1550)[0])                    # la riserva non si tocca
        self.assertTrue(budget.can_spend(led, LIM, 100, 1600)[0])
        self.assertTrue(budget.can_spend(led, LIM, 100, None)[0])                     # crediti residui ignoti: contano i tetti

    def test_record(self):
        led = budget.record(budget.record(budget.empty(NOW), 100, True), 0, False)
        self.assertEqual((led["calls"], led["hits"], led["day_credits"], led["month_credits"]), (2, 1, 100, 100))


class SettingsTest(unittest.TestCase):
    def test_defaults_are_off_and_conservative(self):
        s = settings.load({})
        self.assertFalse(s.enabled)
        self.assertEqual((s.limits.monthly, s.limits.daily, s.limits.reserve, s.min_fit, s.per_cycle), (1000, 300, 1500, 50, 3))

    def test_enable_values_and_clamping(self):
        for on in ("on", "ON", "true", "1", "yes", "sì"):
            self.assertTrue(settings.load({"FIRECRAWL_ENRICH": on}).enabled, on)
        for off in ("", "off", "0", "no", "boh"):
            self.assertFalse(settings.load({"FIRECRAWL_ENRICH": off}).enabled, off)
        s = settings.load({"FIRECRAWL_ENRICH_PER_CYCLE": "99", "FIRECRAWL_ENRICH_MIN_FIT": "500", "FIRECRAWL_ENRICH_DAILY_CREDITS": "-5"})
        self.assertEqual((s.per_cycle, s.min_fit, s.limits.daily), (10, 100, 0))
        self.assertEqual(settings.load({"FIRECRAWL_ENRICH_MONTHLY_CREDITS": "abc"}).limits.monthly, 1000)

    def test_reads_dotenv_with_env_override(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, ".env").write_text('# commento\nFIRECRAWL_API_KEY="fc-abc"\nFIRECRAWL_ENRICH=on\nFIRECRAWL_RESERVE_CREDITS=2000\nALTRO=1\n', encoding="utf-8")
            old = {k: os.environ.pop(k) for k in list(os.environ) if k.startswith("FIRECRAWL_")}
            try:
                s = settings.load(home=Path(d))
                self.assertEqual((s.api_key, s.enabled, s.limits.reserve), ("fc-abc", True, 2000))
                os.environ["FIRECRAWL_RESERVE_CREDITS"] = "3000"
                self.assertEqual(settings.load(home=Path(d)).limits.reserve, 3000)  # l'ambiente vince sul file
            finally:
                os.environ.pop("FIRECRAWL_RESERVE_CREDITS", None)
                os.environ.update(old)

    def test_missing_dotenv_is_fine(self):
        self.assertFalse(settings.load(home=Path("/non/esiste")).enabled)


if __name__ == "__main__":
    unittest.main()
