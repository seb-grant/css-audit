var specificity = require('specificity');
var _ = require('underscore');
var css = require('css');


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
    var _totalSize = 0;
    _.each(selectors, function(sel,s){
        var specObj = specificity.calculate(sel)[0];
        if(specObj && specObj.specificity){
            _sels.push({
                selector: sel,
                specificity: parseSpec(specObj),
                length: sel.length
            });
            _totalSize+=sel.length;
        }

    });


    return {selectors:_sels,totalSize:_totalSize};
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
                        var selectorsAndLength = parseSelectors(rules[r].selectors);
                        _ruleSelectors = selectorsAndLength.selectors;

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
                                lessFile:_lastLessComment,
                                totalLength: selectorsAndLength.totalSize
                            }
                            _rules.push(ruleObj);
                        }
                    }
                }

                var _parsedObj = {
                    href : url,
                    rulesLength : _rulesLength,
                    selectorsLength : _selectorsLength,
                    selectors  : _.sortBy(_selectors,'specificity.value'),
                    size       : Math.round((sheetObj.length / 1024))
                };

                if(sortOrder=='lineNumber'){
                    _parsedObj.rules = _.sortBy(_rules,'lineNumber');
                } else if(sortOrder=='bytes') {
                    _parsedObj.rules = _.sortBy(_rules,'totalLength').reverse();
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

module.exports = {
    parseSheet       : parseSheet,
    parseSpecificity : parseSpec,
    parseSelectors   : parseSelectors
}
