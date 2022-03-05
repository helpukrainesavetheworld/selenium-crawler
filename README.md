# Requirements
- Node.js(>14) + npm (>7)

Autodiscovery of the XHR requests from the website and testing for the slowest data. The resulting file is config.json will be created in the launch folder.

### Attention!
Was not extensively tested, captures only XHR requests that are the result of accessing the page. Doesn't test forms. Crawls only links (`<a href>`). Doesn't show progress for slow request search, so please be patient.

A testing server is included, that exposes a simple webpage with two type of requests - GET and POST. To launch the server run `npm run server`. To test the code, launch `npm run start-testing` and you'll see the activity in the console.

To launch against any host, run `npm start -- https://host.com`. Can take a while, especially for the searching of the slowest requests.

# Configuration

`.data` folder contains temp Chrome data, make sure to remove it if encountering issues or want to clear the cache. This folder speeds up the process quite a bit.

```
const MAXIMUM_DEPTH = 3;
const EXTRACTION_LIMIT_TOP_REQUESTS = 3;
const REPEAT_REQUEST_TIMES = 5;
```

MAXIMUM_DEPTH controls the depth of the traversal. Program uses depth-first search. As some links might link to the different level, `visited` keeps track of all already visited places.

EXTRACTION_LIMIT_TOP_REQUESTS controls how many top slow requests will be returned.

EDGE_CASES map contains all the potentially slow cases that will be tested. Feel free to adjust the functions if you want to test different input.