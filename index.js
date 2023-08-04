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

  if (
    interceptedRequest.method() === "GET" &&
    interceptedRequest.url().endsWith(`/catalog`)
  ) {
    const newCatalog = `https://wsloja.ifood.com.br/ifood-ws-v3/v1/merchants/${merchantId}/catalog`;
    const headers = interceptedRequest.headers();
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
    headless: false,
    devtools: true
  });
  const page = await browser.newPage();
  page.on("request", onRequest);
  await preparePageForTests(page);
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
