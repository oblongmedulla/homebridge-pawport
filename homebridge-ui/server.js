const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');

class UiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    // Handle the request from the HTML button
    this.onRequest('/get-creds', async ({ email, password }) => {
      const response = await fetch('https://api.app.pawport.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation login($email: String!, $password: String!) {
            login(email: $email, password: $password) { token }
          }`,
          variables: { email, password }
        })
      });
      
      const data = await response.json();
      if (!data.data?.login?.token) throw new Error('Invalid login');
      
      const token = data.data.login.token;
      
      // Fetch doors using that token
      const doorRes = await fetch('https://api.app.pawport.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ query: 'query { getDoors { id name } }' })
      });
      
      const doorData = await doorRes.json();
      return { token, doors: doorData.data.getDoors };
    });

    this.ready();
  }
}

(() => new UiServer())();