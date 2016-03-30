var express = require('express');
var router = express.Router();
var request = require('request');
var jsdom = require('jsdom');
var cssUtils = require('../css-utils');
var specificity = require('specificity');
var ucss = require('ucss');

var createStyleSheetObjects = function (ssURLs, res, sortOrder) {
    var _sheets = ssURLs;
    var _sheetCount = _sheets.length,
        _sheetIDX = 0,
        _ss = [];

        console.log(ssURLs)

    ssURLs.forEach(function (url, idx) {
        if (url && url !== 'null') {

            try {
                console.log("Sheet " + (idx + 1) + " of " + _sheetCount);
                console.log("Getting stylesheet from: " + url);

                request({uri: url, strictSSL: false}, function (err, response, body) {
                    if(err){
                        console.log("error")
                        console.log(err)
                        _sheetCount--;
                    } else {
                        var parsedSheet = cssUtils.parseSheet(body, url, sortOrder);

                        c

                        if(parsedSheet && "object"===typeof(parsedSheet)){
                            _ss.push(parsedSheet);
                        } else {
                            _sheetCount--;
                        }
                    }

                    if(_ss.length == _sheetCount) res.render('report', {title: 'CSSAudit', sheets: _ss});
                });

            } catch (e) {
                console.log(e)
            }

        }

    });

};


/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', { title: 'CSSAudit' });
});

router.post('/specify', function (req, res) {

    if (req.body.selector) {
        var specObj = specificity.calculate(req.body.selector)[0];

        var _specificity = cssUtils.parseSpecificity(specObj)

        console.log(_specificity)

        res.render('index', { specificity: _specificity, selector: specObj.selector, title: 'Specificty Tested on: ' + req.body.selector });
    }

});

router.post('/spider',function(req,res){
    var auditUrl = req.body.siteurl,
        _sheetURLs = [],
        _htmlURLs  = ["<html><head></head><body class='foo'></body></html>"],
        _err;


    var cfg = {
        pages : {
            crawl : _htmlURLs
        }
    };

    var doTheAudit = function(s){
        var context = {
            whitelist: [".baz"], // CSS selectors to ignore
            auth: null, // For login (please se example elsewhere)
            timeout: 400 // Request timeout (defaults to 400ms)
        };
        var logger = null; // Function for logging HTTP requests

    // Do the magic
        ucss.analyze(cfg.pages, s, context, logger, function(result) {
            // Do something to the result object
            console.log(result);
        });
    };

    var getHostName = function (url) {
        var matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i),
            protocol = url.substring(0, (url.indexOf(':')));

        return protocol + "://" + (matches && matches[1]);
    };

    var getFullPath = function(auditUrl,ssHREF){

        var protocol = auditUrl.substring(0, (auditUrl.indexOf(':'))),
            _ssHREF = ssHREF;

        if(ssHREF.substring(0,2)=="//"){
            _ssHREF = protocol+":"+ssHREF;
        } else if(ssHREF.substring(0,3)=="../"){
            // TODO: parse this properly!
        } else if(ssHREF.substring(0,4)=="http"){

        } else if(ssHREF.substring(0,1)=="/"){
            _ssHREF = getHostName(auditUrl)+ssHREF;
        } else {
            _ssHREF = auditUrl+"/"+ssHREF;
        }

        return _ssHREF;
    };

    
    request({uri: auditUrl, strictSSL: false}, function (err, response, body) {
        jsdom.env(body, function (err, win) {
            if (err) {
                _err = {
                    title: "Error",
                    msg: "There was an error retrieving stylesheets.",
                    detail: err
                };
                res.render('error', {error: _err});

            } else {
                var doc = win.document,
                    linkTags = doc.getElementsByTagName('link'),
                    l;

                if (!linkTags.length>0) {
                    _err = {
                        title: "Error",
                        msg: "No stylesheets found at this location.",
                        detail: err
                    }
                    res.render('error', {error: _err});
                } else {

                    for (l in linkTags) {
                        if ("undefined" !== typeof linkTags[l].rel && linkTags[l].rel === "stylesheet") {
                            var _ssHREF = linkTags[l].href.replace('.gz.','.');
                            _sheetURLs.push(getFullPath(auditUrl,_ssHREF));
                        }
                    }
                }

            }
            doTheAudit(_sheetURLs);
        });
    });    

    

});

router.post('/report', function (req, res) {

    var auditUrl = req.body.siteurl,
        sortOrder = req.body.sortBy,
        _sheetURLs = [],
        _err;

    if (auditUrl.indexOf("http") !== 0) auditUrl = "http://" + auditUrl;

    console.log("----|     CSSAUDIT     |----")
    console.log("Auditing: " + auditUrl);
    console.log("Sorting by: " + sortOrder)
    console.log("Log output to: /var/log/dokku/cssaudit/web.00.log")
    console.log("----------------------------")

    var getHostName = function (url) {
        var matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i),
            protocol = url.substring(0, (url.indexOf(':')));

        return protocol + "://" + (matches && matches[1]);
    };

    var getFullPath = function(auditUrl,ssHREF){

        var protocol = auditUrl.substring(0, (auditUrl.indexOf(':'))),
            _ssHREF = ssHREF;

        if(ssHREF.substring(0,2)=="//"){
            _ssHREF = protocol+":"+ssHREF;
        } else if(ssHREF.substring(0,3)=="../"){
            // TODO: parse this properly!
        } else if(ssHREF.substring(0,4)=="http"){

        } else if(ssHREF.substring(0,1)=="/"){
            _ssHREF = getHostName(auditUrl)+ssHREF;
        } else {
            _ssHREF = auditUrl+"/"+ssHREF;
        }

        return _ssHREF;
    };

    console.log("Spidering "+auditUrl+" for stylesheets");

    request({uri: auditUrl, strictSSL: false}, function (err, response, body) {
        jsdom.env(body, function (err, win) {
            if (err) {
                _err = {
                    title: "Error",
                    msg: "There was an error retrieving stylesheets.",
                    detail: err
                };
                res.render('error', {error: _err});

            } else {
                var doc = win.document,
                    linkTags = doc.getElementsByTagName('link'),
                    l;

                if (!linkTags.length>0) {
                    _err = {
                        title: "Error",
                        msg: "No stylesheets found at this location.",
                        detail: err
                    }
                    res.render('error', {error: _err});
                } else {

                    for (l in linkTags) {
                        if ("undefined" !== typeof linkTags[l].rel && linkTags[l].rel === "stylesheet") {
                            var _ssHREF = linkTags[l].href.replace('.gz.','.');
                            _sheetURLs.push(getFullPath(auditUrl,_ssHREF));
                        }
                    }
                    createStyleSheetObjects(_sheetURLs, res, sortOrder);

                }

            }

        });
    });

});

router.post('/directreport', function (req, res) {

    var auditUrl = req.body.sheeturl,
        sortOrder = req.body.sortBy,
        _sheetURLs = [],
        _err;

    if (auditUrl.indexOf("http") !== 0) auditUrl = "http://" + auditUrl;

    console.log("----|     CSSAUDIT     |----");
    console.log("Auditing: " + auditUrl);
    console.log("Sorting by: " + sortOrder);
    console.log("----------------------------")

    if(auditUrl){
        console.log("Parsing stylesheet "+auditUrl+" directly");
        createStyleSheetObjects([auditUrl],res, sortOrder);
    } else {

        res.render('error', {error: "No stylesheet"});
    }

});


router.get('/report', function (req, res) {
    res.redirect('/')
});


module.exports = router;
