var express = require('express');
var router = express.Router();
var request = require('request');
var jsdom = require('jsdom');
var cssUtils = require('css-utils');
var _ = require('underscore');
var specificity = require('specificity');

var createStyleSheetObjects = function(ssURLs,res,sortOrder){
	var _sheets = ssURLs;
	var _sheetCount = _sheets.length,
		_sheetIDX = 0,
		_ss = [];

        _.each(ssURLs,function(url,idx){
	        if(url && url!=='null'){

		        try {
			        console.log("Sheet "+(idx+1)+" of "+_sheetCount);
		            console.log("Getting stylesheet from: "+url);
		            request({uri:url,strictSSL:false},function(err,response,body){
                        _ss.push(cssUtils.parseSheet(body,url,sortOrder));
			            if(_ss.length===_sheetCount){
				            res.render('report',{title:'CSSAudit',sheets:_ss});
			            }
		            });

		        } catch(e){
			        console.log(e)
		        }

	        } else {
		        _sheetCount--;
	        }

        });

};


/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'CSSAudit' });
});

router.post('/specify',function(req,res){

	if(req.body.selector){
		var specObj = specificity.calculate(req.body.selector)[0];
		res.render('index', { specificity:cssUtils.parseSpecificity(specObj), selector:specObj.selector, title:'Specificty Tested on: '+req.body.selector } );
	}

});

router.post('/report',function(req,res){

	var auditUrl = req.body.siteurl,
		sortOrder = req.body.sortBy,
        _sheetURLs = [],
        _err;

    if(auditUrl.indexOf("http")!==0) auditUrl = "http://"+auditUrl;

	console.log("----|     CSSAUDIT     |----" )
	console.log("Auditing: "+auditUrl);
	console.log("Sorting by: "+sortOrder)
	console.log("----------------------------" )

    var getHostName = function(url){
        var matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i),
            protocol = url.substring(0,(url.indexOf(':')));

        return protocol+"://"+(matches && matches[1]);
    };

    request({uri:auditUrl,strictSSL:false},function(err,response,body){
        jsdom.env(body,function(err,win){
                if(err){
                    _err = {
                        title: "Error",
                        msg  : "There was an error retrieving stylesheets.",
                        detail : err
                    }
                    res.render('error',{error:_err});

                } else {
                    var doc = win.document,
                        linkTags = doc.getElementsByTagName('link'),
                        l;

                    if(!linkTags){
                        _err = {
                            title: "Error",
                            msg  : "No stylesheets found at this location.",
                            detail : err
                        }
                        res.render('error',{error:_err});
                    } else {

                        for(l in linkTags){
                            if("undefined" !== typeof linkTags[l].rel &&
                                linkTags[l].rel==="stylesheet" ){
                                var _ssHREF = linkTags[l].href;
                                if(_ssHREF.indexOf('http')!==0){
                                    _ssHREF = getHostName(auditUrl)+_ssHREF;
                                }
                                _sheetURLs.push(_ssHREF);
                            }
                        }
                        console.log("Parsing stylesheets: "+_sheetURLs);
                        createStyleSheetObjects(_sheetURLs,res,sortOrder);

                    }

                }

            }
        );
    })

});


router.get('/report',function(req,res) {
	res.redirect('/')
});


module.exports = router;
