const puppeteer = require("puppeteer");

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

const onRequest = (interceptedRequest) => {
  if (interceptedRequest.isInterceptResolutionHandled()) return;

  if (block.some((b) => interceptedRequest.url().includes(b))) {
    interceptedRequest.abort();
    return;
  }

  interceptedRequest.continue();
};

let catalogJson = null;
const onResponse = async (response) => {
  console.log(response.status(), response.url());
  if (
    response.request().method() === "GET" &&
    response.url().endsWith(`/catalog`)
  ) {
    catalogJson = await response.json();
  }
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
    uri =
      "https://www.ifood.com.br/delivery/sao-jose-dos-campos-sp/churraskilo-bethania-jardim-sao-dimas/65565aaf-c775-4dcf-87e5-2d5a9b44c403";
  }

  catalogJson = null;
  const browser = await puppeteer.launch({
    args: ["--no-sandbox"],
    headless: `new`,
  });
  const page = await browser.newPage();
  page.on("response", onResponse);
  page.on("request", onRequest);
  await preparePageForTests(page);
  await page.goto(uri);

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (catalogJson != null) {
      break;
    }
  }

  await browser.close();

  console.log(`finish`, catalogJson);

  return catalogJson;
};

getIFoodMenu();
