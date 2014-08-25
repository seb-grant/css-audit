var express = require('express');
var router = express.Router();
var phantom = require('phantom');
var specificity = require('specificity');

var theSS = [];


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

var parseSheet = function(sheetObj){
	var rules = sheetObj.rules;

	if(rules){

		var _rulesLength = rules.length,
			_selectorsLength = 0,
			_selectors = [],
			_rules = [],
			r = 0, s = 0;

		for (; r < _rulesLength; r++) {
			if (rules[r] && rules[r].selectorText){
				var ruleSelectors = rules[r].selectorText.split(',');
				_selectorsLength += ruleSelectors.length;
				_rules.push(rules[r].style.cssText);
				for(s in ruleSelectors){

					var specObj = specificity.calculate(ruleSelectors[s])[0];

					_selectors.push({
						selector:ruleSelectors[s],
						specificity : parseSpec(specObj),
						ruleId:r
					});
				}
			}
		}

		_parsedObj = {
			href : sheetObj.href,
			rulesLength : _rulesLength,
			rules : _rules,
			selectorsLength : _selectorsLength,
			selectors : _selectors
		};

		return _parsedObj;

	}


};


var createStyleSheetObjects = function(res){
	var _sheets = res.locals.sheets;
	var _sheetCount = _sheets.length,
		_sheetIDX = 0,
		_ss = [];

	console.log("Received "+_sheetCount+" stylesheets to attempt to parse");

	for(;_sheetIDX<_sheetCount;_sheetIDX++){

		if(_sheets[_sheetIDX]){
			console.log(typeof(_sheets[_sheetIDX]));
			if("object"===typeof(_sheets[_sheetIDX].cssRules)){
				console.log("Stylesheet named "+_sheets[_sheetIDX].href+" to attempt to parse");
				_ss.push( parseSheet(_sheets[_sheetIDX]) );
			}
		}
	}


	res.render('report',{sheets:_ss});

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

	var auditUrl = req.body.siteurl;

	phantom.create("--web-security=no", "--ignore-ssl-errors=yes", { port: 12345 }, function (ph) {
		ph.createPage(function (page) {
			page.open(auditUrl,function(status){

				setTimeout(function(){
					page.evaluate(function(){
						return document.styleSheets;
					},function(result){
						res.locals.sheets = result;
						createStyleSheetObjects(res);
						ph.exit();
					});
				},1000);
			});

		});

	});

});


router.get('/report',function(req,res) {
	res.render('report',{
		title: 'Report',
		data: {
			selectors:4,
			rules:2
		}
	});
});


module.exports = router;
