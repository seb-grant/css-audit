var express = require('express');
var router = express.Router();
var specificity = require('specificity');
var _ = require('underscore');
var css = require('css');
var request = require('request');
var jsdom = require('jsdom');

var parseSpec = function(specObj){

	var _specObj = specObj.specificity.split(','),
		parsedObj = {
			raw  : specObj.specificity,
			thou : _specObj[0],
			hund : _specObj[1],
			tens : _specObj[2],
			unit : _specObj[3],
			value : (_specObj[0]*1000)+(_specObj[1]*100)+(_specObj[2]*10)+(parseInt(_specObj[3]))
		};

	return parsedObj;
};

var parseSelectors = function(selectors){
	var _sels = [];
	_.each(selectors, function(sel,s){
		var specObj = specificity.calculate(sel)[0];
		if(specObj && specObj.specificity){
			_sels.push({
				selector: sel,
				specificity: parseSpec(specObj)
			});
		}

	});
	return _sels;
}

var parseSheet = function(sheetObj,url,sortOrder){

    var theCss = css.parse(sheetObj);

    if(theCss){
	    try {
	        var rules = theCss.stylesheet.rules;

		    if(rules){

			    var _rulesLength = rules.length,
					    _ruleSelectors = [],
					    _selectorsLength = 0,
					    _selectors = [],
					    _rules = [],
					    r = 0, s = 0,
					    _lastLessComment = "";

			    var buildRuleString = function(rule){
				    var _str = "";
				    _.each(rule.declarations, function(e,i){
					    _str += e.property+":"+ e.value+"; ";
				    })
				    return _str;
			    }

			    for (; r < _rulesLength; r++) {
				    if (rules[r] && rules[r].selectors){

					    _ruleSelectors = parseSelectors(rules[r].selectors);
					    _selectorsLength += rules[r].selectors.length;

					    if(rules[r].declarations[0] && rules[r].declarations[0].type==="comment"){
						    if(rules[r].declarations[0].comment.indexOf('.less')>-1)
						        _lastLessComment = rules[r].declarations[0].comment.replace(/-/g,'');
					    }

					    if(rules[r].declarations && "object" === typeof(rules[r].declarations)){
						    var ruleObj = {
							    declarations:rules[r].declarations,
							    selectorCount:_ruleSelectors.length,
							    selectors:_ruleSelectors,
							    lineNumber:rules[r].position.start.line,
							    lessFile:_lastLessComment
						    }
						    _rules.push(ruleObj);
					    }
				    }
			    }

			    var _parsedObj = {
				    href : url,
				    rulesLength : _rulesLength,
				    selectorsLength : _selectorsLength,
				    selectors : _.sortBy(_selectors,'specificity.value'),
                    size      : Math.round((sheetObj.length / 1024))
			    };

			    if(sortOrder=='lineNumber'){
				    _parsedObj.rules = _.sortBy(_rules,'lineNumber');
			    } else {
				    _parsedObj.rules = _.sortBy(_rules,'selectorCount').reverse();
			    }

			    return _parsedObj;

		    }

	    } catch(e){
		    console.log("There was an error parsing "+url);
		    console.log(e);
	    }


    } else {
        console.log("The CSS could not be parsed");
    }

};


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
                        _ss.push(parseSheet(body,url,sortOrder));
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
		res.render('index', { specificity:parseSpec(specObj), selector:specObj.selector, title:'Specificty Tested on: '+req.body.selector } );
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
