import { isBoolean, isNumber, isString } from 'util';
import { RSQLFilterExpressionOptions } from './rsql-filter-expression-options';
import { Operators } from './rsql-filter-operators';
import { CustomOperator } from '..';

export class RSQLFilterExpression {
  public field: string;
  public operator: Operators | undefined;
  public customOperator: CustomOperator | undefined;
  public value: string | Array<string | number | boolean> | Date | number | boolean | undefined;
  public options: RSQLFilterExpressionOptions;

  constructor(
    field: string,
    operator: Operators | CustomOperator,
    value: string | Array<string | number | boolean> | Date | number | boolean | undefined,
    options: RSQLFilterExpressionOptions = { includeTimestamp: false }
  ) {
    this.field = field;
    if (typeof operator === 'object' && this.instanceOfCustomOperator(operator)) {
      this.operator = undefined;
      this.customOperator = operator as CustomOperator;
    } else {
      this.operator = operator as Operators;
      this.customOperator = undefined;
    }

    this.value = value;
    this.options = options;
  }

  /**
   * Builds the individual filter expression into the proper format.
   */
  public build(): string {
    let filterString = '';
    let shouldQuote = false;
    // convert the value into an appropriate string.
    let valueString: string = '';
    if (isString(this.value)) {
      valueString = this.value;
      valueString = valueString.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      shouldQuote = true;
    }
    if (isNumber(this.value)) {
      valueString = this.value.toString();
    }
    if (isBoolean(this.value)) {
      valueString = this.value ? 'true' : 'false';
    }
    if (this.value instanceof Array) {
      let quotedValues = this.value.filter(i => i !== undefined).map(i => {
        if (isNumber(i)) {
          return i;
        } else if (isString(i)) {
          let val = i.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          return encodeURIComponent(quote(val));
        } else {
          return encodeURIComponent(quote(i));
        }
      });
      valueString = quotedValues.join(',');
    }
    if (this.value instanceof Date) {
      if (this.options.includeTimestamp) {
        valueString = this.buildDateString(this.value, true) + this.buildTimestamp(this.value);
      } else {
        valueString = this.buildDateString(this.value, false);
      }

      shouldQuote = true;
    }
    if (this.value === null) {
      valueString = 'null';
    }
    // construct the filter string
    filterString += this.field;

    if (this.customOperator !== undefined) {
      filterString += this.customOperator.convertToRSQLString(this.value, valueString, shouldQuote);
    } else {
      switch (this.operator) {
        case Operators.Equal:
          filterString +=
            '=in=' + encodeURIComponent(shouldQuote ? quote(valueString) : valueString);
          break;
        case Operators.NotEqual:
          filterString += '!=' + encodeURIComponent(shouldQuote ? quote(valueString) : valueString);
          break;
        case Operators.Like:
          filterString += '==' + encodeURIComponent(quote(valueString));
          break;
        case Operators.GreaterThan:
          filterString += encodeURIComponent('>') + valueString;
          break;
        case Operators.GreaterThanEqualTo:
          filterString += encodeURIComponent('>=') + valueString;
          break;
        case Operators.LessThan:
          filterString += encodeURIComponent('<') + valueString;
          break;
        case Operators.LessThanEqualTo:
          filterString += encodeURIComponent('<=') + valueString;
          break;
        case Operators.StartsWith:
          filterString += '==' + encodeURIComponent(quote(`${valueString}*`));
          break;
        case Operators.EndsWith:
          filterString += '==' + encodeURIComponent(quote(`*${valueString}`));
          break;
        case Operators.Contains:
          filterString += '==' + encodeURIComponent(quote(`*${valueString}*`));
          break;
        case Operators.DoesNotContain:
          filterString += '!=' + encodeURIComponent(quote(`*${valueString}*`));
          break;
        case Operators.In:
          filterString += '=in=(' + valueString + ')';
          break;
        case Operators.NotIn:
          filterString += '=out=(' + valueString + ')';
          break;
        case Operators.IsEmpty:
          filterString += '==' + encodeURIComponent('""');
          break;
        case Operators.IsNotEmpty:
          filterString += '!=' + encodeURIComponent('""');
          break;
        case Operators.IsNull:
          filterString += '==null';
          break;
        case Operators.IsNotNull:
          filterString += '!=null';
          break;
      }
    }

    return filterString;
  }

  private instanceOfCustomOperator(object: any): object is CustomOperator {
    return 'convertToRSQLString' in object;
  }

  private buildDateString(dateObject: Date, useUTC: boolean): string {
    let year;
    let month;
    let date;

    if (useUTC) {
      year = dateObject.getUTCFullYear();
      month = dateObject.getUTCMonth() + 1;
      date = dateObject.getUTCDate();
    } else {
      year = dateObject.getFullYear();
      month = dateObject.getMonth() + 1;
      date = dateObject.getDate();
    }

    let yearString = this.numberToString(year, 4);
    let monthString = this.numberToString(month, 2);
    let dateString = this.numberToString(date, 2);

    return [yearString, monthString, dateString].join('-');
  }

  /**
   * Returns a timestamp in the ISO 8601 format for the given Date object, using UTC values (i.e. 'T'HH:mm:ss.SSS'Z').
   */
  private buildTimestamp(dateObject: Date): string {
    let hours = dateObject.getUTCHours();
    let minutes = dateObject.getUTCMinutes();
    let seconds = dateObject.getUTCSeconds();
    let millis = dateObject.getUTCMilliseconds();

    let hoursString = this.numberToString(hours, 2);
    let minutesString = this.numberToString(minutes, 2);
    let secondsString = this.numberToString(seconds, 2);
    let millisString = this.numberToString(millis, 3);

    return 'T' + [hoursString, minutesString, secondsString].join(':') + '.' + millisString + 'Z';
  }

  /**
   * Returns a string of the given number, ensuring the total number of digits
   * is as specified by left-padding with zeros if necessary.
   * e.g. numberToString(8, 3) === '008'
   */
  private numberToString(num: number, digitCount: number): string {
    let s = String(num);

    while (s.length < digitCount) {
      s = '0' + s;
    }

    return s;
  }
}

export function quote(value: string | boolean): string {
  return `"${value}"`;
}
