var
  utils   = require('./utils')
, helpers = require('./conditional-helpers')
;

module.exports = function(where, table, values){
  var buildConditions = function(where, condition, column, joiner){
    joiner = joiner || ' && ';
    if (column) {
      console.log('column', column)
      column = utils.quoteObject(column, table);
      console.log('column ....', column)
    }

    var conditions = [], result;

    for (var key in where) {

      // If the value is null, send a $null helper through the condition builder
      if ( where[key] === null ) {
        var tmp = {};
        tmp[key] = { $null: true };
        conditions.push( buildConditions(tmp, condition, column, joiner) );
        continue;
      }

      if (typeof where[key] == 'object' && !(where[key] instanceof Date) && !Buffer.isBuffer(where[key])) {

        // Key is conditional block
        if (helpers.has(key)) {
          // If it cascades, run it through the builder using the helper key
          // as the current condition
          // If it doesn't cascade, run the helper immediately
          if (helpers.get(key).options.cascade)
            (result = buildConditions(where[key], key, column)) && conditions.push(result);
          else
            (result = helpers.get(key).fn(column, where[key], values, table, where[key])) && conditions.push(result);
        }

        // Key is Joiner
        else if (key == '$or')
          (result = buildConditions(where[key], condition, column, ' || ')) && conditions.push(result);
        else if (key == '$and')
          (result = buildConditions(where[key], condition, column)) && conditions.push(result);

        // Key is array index
        else if (+key >= 0)
          (result = buildConditions(where[key], condition, column)) && conditions.push(result);

        // Key is column
        else
          (result = buildConditions(where[key], condition, key)) && conditions.push(result);

        continue;
      }

      // Key is a helper, use that for this value
      if (helpers.has(key))
        conditions.push(
          helpers.get(key).fn(
            column
          , utils.parameterize(where[key], values)
          , values
          , table
          , where[key]
          )
        );

      // Key is an array index
      else if (+key >= 0)
        conditions.push(
          helpers.get(condition).fn(
            column
          , utils.parameterize(where[key], values)
          , values
          , table
          , where[key]
          )
        );

      // Key is a column
      else
        conditions.push(
          helpers.get(condition).fn(
            (column || table) + '.' + key
          , utils.parameterize(where[key], values)
          , values
          , table
          , where[key]
          )
        );
    }

    if (conditions.length > 1) return '(' + conditions.join(joiner) + ')';
    if (conditions.length == 1) return conditions[0];
  };

  // Always remove outer-most parenthesis
  var result = buildConditions(where, '$equals');
  if (!result) return '';
  if (result[0] == '(') return result.substring(1, result.length - 1);
  return result;
};
