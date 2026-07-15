export class WindsorClient {
  private static get API_KEY() {
    return process.env.WINDSOR_API_KEY;
  }
  
  private static BASE_URL = 'https://connectors.windsor.ai/all';

  /**
   * Fetch data from Windsor.ai for a specific connector and account.
   */
  static async getData({
    connector,
    accountId,
    fields,
    datePreset = 'last_30d',
  }: {
    connector: string;
    accountId?: string;
    fields: string[];
    datePreset?: string;
  }) {
    if (!this.API_KEY) {
      throw new Error('WINDSOR_API_KEY is not configured');
    }

    const params = new URLSearchParams({
      api_key: this.API_KEY,
      date_preset: datePreset,
      fields: fields.join(','),
    });
    
    // Add connector to URL
    const url = `${this.BASE_URL}?${params.toString()}&connector=${connector}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Windsor API Error:', errorData);
        throw new Error(`Windsor API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Filtra i risultati se l'accountId è specificato
      if (accountId && data.data) {
        return data.data.filter((row: any) => row.account_id === accountId);
      }

      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch from Windsor:', error);
      throw error;
    }
  }
}
