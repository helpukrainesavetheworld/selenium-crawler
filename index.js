const puppeteer = require('puppeteer');
const urlParser = require('url');
const axios = require('axios').default;

let xhrRequests = {};
let visited = {};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const ROOT_URL = "http://localhost:3000/";
const MAXIMUM_DEPTH = 2;

const IGNORED_RESOURCE_TYPES = ['stylesheet', 'font', 'image', 'media'];

const chars = '​ 😀😃😄😁😆😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👹👺🤡💩👻💀☠️👽👾🤖🎃😺😸😹😻😼😽🙀😿😾诶诶必ъ比西ъ西弟ъ迪衣伊艾付	艾弗记吉爱耻艾尺挨艾宅杰开开饿罗艾勒饿母艾马恩艾娜呕哦披屁酷吉吾耳艾儿艾斯艾丝大波留豆贝尔维埃克斯艾克斯歪吾艾再得贼德zéidéēibǐxīdíyīàifújíàichǐàijiékāiàilèàimǎàinàópìjíwúàiéràisīdòubèiěrwéiyīkèsīwúàiАБВГҐДЂЃЕЁЄЖЗЗ́ЅИІЇЙЈКЛЉМНЊОПРСС́ТЋЌУЎФХЦЧЏШЩЪЫЬЭЮЯӐӘӔҒҔӺӶӁӜӠҠҞӉҢӇҤӨҨҎҪУ̃ӮӰӲҮҲӼӾҺҴҶӋҸҼҌӀꙖѤѦѪѨѬѮѰꙞѲѴѶҀОѠѾѢ★☆✡✦✧✩✪✫✬✭✮✯✰⁂⁎⁑✢✣✤✥✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❇❈❉❊❋❄❆❅⋆≛ᕯ✲࿏꙰۞⭒⍟©®™℠℡℗‱№℀℁℅℆⅍☊☎☏⌨✁✂✃✄✆✇✈✉✎✏✐✑✒‰§¶✌☞☛☟☜☚✍¢$€£¥₮৲৳௹฿៛₠₡₢₣₤₥₦₧₨₩₪₫₭₯₰₱₲₳₴₵￥﷼¤ƒ〈〉《》「」『』【】〔〕︵︶︷︸︹︺︻︼︽︾︿﹀﹁﹂﹃﹄﹙﹚﹛﹜﹝﹞﹤﹥（）＜＞｛｝〖〗〘〙〚〛«»‹›〈〉〱♔♕♖♗♘♙♚♛♜♝♞♟♤♠♧♣♡♥♢♦';

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


function fetch(browser, url, currentLevel) {
    console.log("Processing URL: " + url + ", level: " + currentLevel);

    return new Promise(async (resolve, reject) => {
        try {
            const page = await browser.newPage();
            await page.setRequestInterception(true);

            page.on('request', (request) => {
                if (!IGNORED_RESOURCE_TYPES.includes(request.resourceType())) {
                    if (['xhr', 'fetch'].includes(request.resourceType())) {
                        const requestUrl = request._url;
                        if (!xhrRequests[requestUrl]) {
                            const query = urlParser.parse(requestUrl, true).query;
                            let contentType;
                            
                            if (Object.keys(query).length > 0) {
                                queryObject = JSON.stringify(urlParser.parse(requestUrl, true).query);
                                contentType = extractFieldTypes(JSON.parse(queryObject));
                            } else if (request._postData) {
                                contentType = extractFieldTypes(JSON.parse(request._postData));
                            }

                            xhrRequests[requestUrl] = {
                                "url": request._url,
                                "method": request._method,
                                "payload": request._postData,
                                "query_params": queryObject,
                                "content_type": contentType
                            };
                        }
                    }
                    request.continue();
                } else {
                    request.abort();
                }
            });
            await page.goto(url);
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
                await delay(250);
                await fetch(browser, ROOT_URL + url, currentLevel + 1);
                visited[url] = true;
            }
            return resolve();
        } catch (e) {
            return resolve();
        }
    })
}

async function start() {
    const browser = await puppeteer.launch({
        userDataDir: './.data',
    });
    await fetch(browser, ROOT_URL, 1);
    await browser.close();
    console.log(xhrRequests);

    for (url of Object.keys(xhrRequests)) {
        const request = xhrRequests[url];
        if (request.method === 'GET') {
            await axios.get(request.url, {
                params: {
                    login : 'test',
                    password: 'tdfsgd',
                }
            });
        } else {
            // resuling in array. url should not contain query params, to fix
            await axios.post(request.url, {
                login : 'test',
                password: 'tdfsgd',
            });
        }
    }
}

start();