var express = require('express');
var router = express.Router();
var phantom = require('phantom');
var specificity = require('specificity');
var _ = require('underscore');
var css = require('css');
var request = require('request');

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

			    _parsedObj = {
				    href : url,
				    rulesLength : _rulesLength,
				    selectorsLength : _selectorsLength,
				    selectors : _.sortBy(_selectors,'specificity.value')
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
		res.render('index', { specificity:parseSpec(specObj), selector:specObj.selector } );
	}

});

router.post('/report',function(req,res){

	var auditUrl = req.body.siteurl,
		sortOrder = req.body.sortBy;

	console.log("----|     CSSAUDIT     |----" )
	console.log("Auditing: "+auditUrl);
	console.log("Sorting by: "+sortOrder)
	console.log("----------------------------" )

	phantom.create("--web-security=no", "--ignore-ssl-errors=yes", { port: 12345 }, function (ph) {
		ph.createPage(function (page) {
			page.open(auditUrl,function(status){

				page.evaluate(function(){
                    var _ss = "", s=0;
                    for(;s<document.styleSheets.length;s++){
	                    if(document.styleSheets.item(s)['href']){
                            _ss+=document.styleSheets.item(s)['href']+"|";
	                    }
                    }
                    return _ss.substring(0,_ss.length-1);
				},function(result){
                    var ssURLs = result.split('|');
                    var sheets = createStyleSheetObjects(ssURLs,res,sortOrder);
                    ph.exit();
				});

			});

		});

	});

});


router.get('/report',function(req,res) {
	res.redirect('/')
});


module.exports = router;
