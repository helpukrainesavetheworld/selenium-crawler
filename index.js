const puppeteer = require('puppeteer');
const urlParser = require('url');
const axios = require('axios').default;
const fs = require('fs');

let xhrRequests = [];
let visited = {};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const MAXIMUM_DEPTH = 3;
const EXTRACTION_LIMIT_TOP_REQUESTS = 3;
const REPEAT_REQUEST_TIMES = 5;
const IGNORED_RESOURCE_TYPES = ['stylesheet', 'font', 'image', 'media'];

function detectValueType(value) {
    if (value && value instanceof Object) {
        return "object";
    } else if (typeof value === 'string') {
        if (/^(true|false)$/.test(value)) {
            return "boolean";
        } else if (Number.isSafeInteger(parseFloat(value))) {
            return "int";
        } else if (parseFloat(value)) {
            return "float";
        }
        return "string";
    } else if (typeof value === 'number') {
        if (Number.isSafeInteger(parseFloat(value))) {
            return 'int';
        } else {
            return 'float';
        }
    } else if (typeof value === 'boolean') {
        return 'boolean';
    } else if (Array.isArray(value)) {
        return 'array';
    } 

    return result;
}

function extractFieldTypes(input) {
    let schema = {};
    if (input && input instanceof Object) {
       for(key of Object.keys(input)) {
            schema[key] = detectValueType(input[key]);
       }
    }
    return schema;
}


function fetch(browser, rootUrl, currentUrl, currentLevel) {
    console.log("Processing URL: " + currentUrl + ", level: " + currentLevel);

    return new Promise(async (resolve, reject) => {
        try {
            const page = await browser.newPage();
            await page.setRequestInterception(true);

            page.on('request', (request) => {
                if (!IGNORED_RESOURCE_TYPES.includes(request.resourceType())) {
                    if (['xhr', 'fetch'].includes(request.resourceType())) {
                        const requestUrl = request._url;
                        if (!xhrRequests[requestUrl]) {
                            const parsedUrl = urlParser.parse(requestUrl, true);
                            const query = parsedUrl.query;
                            const baseUrl = parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname;
                            let contentType;
                            let data;

                            if (Object.keys(query).length > 0) {
                                data = JSON.parse(JSON.stringify(urlParser.parse(requestUrl, true).query));
                                contentType = extractFieldTypes(data);
                            } else if (request._postData) {
                                data = JSON.parse(request._postData);
                                contentType = extractFieldTypes(data);
                            }

                            xhrRequests[requestUrl] = {
                                "url": baseUrl,
                                "method": request._method,
                                "data": data,
                                "content_type": contentType
                            };
                        }
                    }
                    request.continue();
                } else {
                    request.abort();
                }
            });
            await page.goto(currentUrl);
            let rawUrls = await page.evaluate(() => {
                let results = [];
                let items = document.querySelectorAll('a');
                items.forEach((item) => {
                    results.push(item.getAttribute('href'));
                });
                return results;
            });
            await page.close();

            if (currentLevel === MAXIMUM_DEPTH) return resolve();

            let filtered = rawUrls.filter(url =>
                url != null
                && url != ''
                && !url.startsWith("#")
                && !url.startsWith("/#")
                && !url.startsWith("https://")
                && !visited[url]
            );
            console.log("Found " + filtered.length + " URLs.")
            for (url of filtered) {
                console.log(url);
                await delay(100);
                await fetch(browser, rootUrl, rootUrl + url, currentLevel + 1);
                visited[url] = true;
            }
            return resolve();
        } catch (e) {
            return resolve();
        }
    })
}

function generateConfig(slowRequest) {
    let path = slowRequest.url;
    if (slowRequest.method === 'GET') {
        path += new URLSearchParams(slowRequest.data).toString()
    }

    let baseConfig = {
        "type": "http",
        "args": {
          "method": slowRequest.method,
          "path": path,
          "headers": {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0'
           },
          "interval_ms": 1
        },
        "client": {
            "proxy_urls": "{{ get_proxylist }}"
        }
    }

    if (slowRequest.method === 'POST') {
        baseConfig.args["body"] = slowRequest.data;
    }

    return baseConfig;
}

async function detectSlowData(request) {
    let dataLatencyMap = [];
    for (const [key, type] of Object.entries(request.content_type)) {
        for (value of EDGE_CASES[type]) {
            for (_ in [...Array(REPEAT_REQUEST_TIMES).keys()]) {
                const start = process.hrtime();
                const requestData = {...request.data, ...{ [key]: value } };
                await sendRequest(request, requestData)
                const elapsed = process.hrtime(start)[1];
                dataLatencyMap.push({data: requestData, time: elapsed});
                await delay(100);
            }
        }
    }
    const topSlowRequests = extractSlowRequests(dataLatencyMap);
    return topSlowRequests.map((a) => {
        return a.data
    })
}

function extractSlowRequests(dataLatencyMap) {
    dataLatencyMap.sort((a,b) =>{
      return b.time - a.time;
    });
    return dataLatencyMap.slice(0, EXTRACTION_LIMIT_TOP_REQUESTS);
}

async function sendRequest(request, data) {
    try {
        if (request.method === 'GET') {
            await axios.get(request.url, {
                params: data
            });
        } else {
            await axios.post(request.url, data);
        }
    } catch(e) {
    }
}

const EDGE_CASES = {
    'string': generateStringValues(),
    'boolean': [true, false],
    'int': generateIntValues(),
    'float': generateFloatValues(),
    'array': generateArrayValues(),
    'object': generateObjectValues(),
};

function generateStringValues() {
    return [
        "",
        "                   ",
        "😀😃😄😁😆😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👹👺🤡💩👻💀☠️👽👾🤖🎃😺😸😹😻😼😽🙀😿😾",
        "诶诶必ъ比西ъ西弟ъ迪衣伊艾付	艾弗记吉爱耻艾尺挨艾宅杰开开饿罗艾勒饿母艾马恩艾娜呕哦披屁酷吉吾耳艾儿艾斯艾丝大波留豆贝尔维埃克斯艾克斯歪吾艾再得贼德",
        "zéidéēibǐxīdíyīàifújíàichǐàijiékāiàilèàimǎàinàópìjíwúàiéràisīdòubèiěrwéiyīkèsīwúài",
        "АБВГҐДЂЃЕЁЄЖЗЗ́ЅИІЇЙЈКЛЉМНЊОПРСС́ТЋЌУЎФХЦЧЏШЩЪЫЬЭЮЯ",
        "ӐӘӔҒҔӺӶӁӜӠҠҞӉҢӇҤӨҨҎҪУ̃ӮӰӲҮҲӼӾҺҴҶӋҸҼҌӀꙖѤѦѪѨѬѮѰꙞѲѴѶҀОѠѾѢ",
        "★☆✡✦✧✩✪✫✬✭✮✯✰⁂⁎⁑✢✣✤✥✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❇❈❉❊❋❄❆❅⋆≛ᕯ✲࿏꙰۞⭒⍟©®™℠℡℗‱№℀℁℅℆⅍☊☎☏⌨✁✂✃✄✆✇✈✉✎✏✐✑✒‰§¶✌☞☛☟☜☚✍¢$€£¥₮৲৳௹฿៛₠₡₢₣₤₥₦₧₨₩₪₫₭₯₰₱₲₳₴₵￥﷼¤ƒ〈〉《》「」『』【】〔〕︵︶︷︸︹︺︻︼︽︾︿﹀﹁﹂﹃﹄﹙﹚﹛﹜﹝﹞﹤﹥（）＜＞｛｝〖〗〘〙〚〛«»‹›〈〉〱♔♕♖♗♘♙♚♛♜♝♞♟♤♠♧♣♡♥♢♦",
    ]
}

function generateIntValues() {
    return [
        Number.MIN_VALUE,
        Number.MAX_VALUE,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        -1,
        ...Array(11).keys(),
    ];
}

function generateFloatValues() {
    return [Number.MIN_VALUE, Number.MAX_VALUE]
}

function generateArrayValues() {
    return [
        [],
        generateArray(10),
        generateArray(100),
        generateArray(1000),
    ];
}

function generateArray(size) {
    return [...Array(size).keys()];
}

function generateObjectValues() {
    return [
        {},
        generateObject(10),
        generateObject(100),
        generateObject(1000),
    ];
}

function generateObject(fieldSize) {
    let obj = {};
    for (i of [...Array(fieldSize).keys()]) {
        // random string, length 7
        let r = (Math.random() + 1).toString(36).substring(7);
        obj[i] = r;
    }
    return obj;
}

async function start(rootUrl) {
    const browser = await puppeteer.launch({
        userDataDir: './.data',
    });

    axios.defaults.headers = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
    };

    await fetch(browser, rootUrl, rootUrl, 1);
    await browser.close();
    console.log("Found next requests: ");
    console.log(xhrRequests);
    console.log("Detecting slowest input data...");
    for (const [_, request] of Object.entries(xhrRequests)) {
        const slowData = await detectSlowData(request);
        slowData.forEach((slowData) => {
            const jsonConfig = generateConfig({
                "url": request.url,
                "method": request.method,
                "data": slowData,
            });
            fs.writeFile('config.json', content, err => {
                if (err) {
                  console.error(err)
                  return
                }
            });
        });
    }
}

const url = process.argv.slice(2)[0];
start(url);