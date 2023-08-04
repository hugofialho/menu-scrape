const puppeteer = require("puppeteer");
const fetch = require('node-fetch');

let catalogJson = null;
let merchantId = null;

const block = [
  "google",
  "facebook",
  "newrelic",
  "doubleclick",
  "fstr",
  "capture.trackjs",
  "listener.logz",
  "usage.trackjs",
  "https://static.ifood-static.com.br/",
  ".png"
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const onRequest = async (interceptedRequest) => {
  if (interceptedRequest.isInterceptResolutionHandled()) return;

  if (block.some((b) => interceptedRequest.url().includes(b))) {
    interceptedRequest.abort();
    return;
  }

  if (interceptedRequest.url().endsWith('7fc8fca5-bbb6-4c19-9b9e-baa3ef6169e4.html')) {
    interceptedRequest.continue();
    return;
  }

  if (interceptedRequest.url().includes('file://')) {
    const newUrl = interceptedRequest.url().replace('file:///', 'https://www.ifood.com.br/');
    const resp = await fetch(newUrl)
      .then(res => res.text());
    
    interceptedRequest.respond({
      ok: "OK",
      status: 200,
      body: resp,
    });

    return;
  }


  const apiRequest = !interceptedRequest.url().split('/').pop().includes('.');
  if (apiRequest) {
    console.log('api request', interceptedRequest.url())
    const headers = interceptedRequest.headers();
    console.log(headers)
    console.log('==================================')
  }

  if (
    interceptedRequest.method() === "GET" &&
    interceptedRequest.url().endsWith(`/catalog`)
  ) {
    const newCatalog = `https://wsloja.ifood.com.br/ifood-ws-v3/v1/merchants/${merchantId}/catalog`;
    const headers = interceptedRequest.headers();
    // console.log(headers)
    // console.log(JSON.stringify(headers))
    // const headersLaptop = '{"access_key":"69f181d5-0046-4221-b7b2-deef62bd60d5","x-ifood-device-id":"26c98d79-3b2e-4969-a4b6-08db1a100827","secret_key":"9ef4fb4f-7a1d-4e0d-a9b1-9b82873297d8","browser":"Linux","accept-language":"pt-BR,pt;q=1","user-agent":"Mozilla/5.0 (X11; Linux x86_64)AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36","x-client-application-key":"41a266ee-51b7-4c37-9e9d-5cd331f280d5","accept":"application/json, text/plain, */*","cache-control":"no-cache, no-store","referer":"","x-ifood-session-id":"600541ba-68a4-49e1-bd81-c96638360dbc","x-device-model":"Linux Chrome","platform":"Desktop","app_version":"9.95.4"}'
    // const headers = JSON.parse(headersLaptop);

    const catalogText = await fetch(newCatalog, { headers })
      .then(res => res.text());

    catalogJson = JSON.parse(catalogText);

    interceptedRequest.respond({
      ok: "OK",
      status: 200,
      body: catalogText,
    });

    return;
  }

  interceptedRequest.continue();
};

const preparePageForTests = async (page) => {
  const userAgent =
    "Mozilla/5.0 (X11; Linux x86_64)" +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36";
  await page.setUserAgent(userAgent);
  await page.setRequestInterception(true);

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  await page.evaluateOnNewDocument(() => {
    window.chrome = {
      runtime: {},
      // etc.
    };
  });

  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    return (window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters));
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "languages", {
      get: () => ["pt-BR", "en", "pt"],
    });
  });
};

const getIFoodMenu = async (uri) => {
  if (!uri) {
    //html estatico é do churraskilo 9 de julho
    uri = "https://www.ifood.com.br/delivery/sao-jose-dos-campos-sp/churraskilo-bethania-jardim-sao-dimas/65565aaf-c775-4dcf-87e5-2d5a9b44c403";
  }

  merchantId = uri.split('/').pop();
  catalogJson = null;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox",
    '--disable-web-security',
    '--disable-features=IsolateOrigins',
    '--disable-site-isolation-trials'
  ],
    headless: 'new',
  });
  const page = await browser.newPage();
  page.on("request", onRequest);
  page.on('response', response => {
    const apiRequest = !response.url().split('/').pop().includes('.');
    if (apiRequest) {
      console.log(response.status(), response.url());
    }
  });
  await preparePageForTests(page);
  // await page.goto(uri);
  await page.goto(`file://${__dirname}/7fc8fca5-bbb6-4c19-9b9e-baa3ef6169e4.html`);

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (catalogJson != null) {
      break;
    }
  }

  // await browser.close();

  console.log(`finish`, catalogJson);

  return catalogJson;
};

getIFoodMenu();
