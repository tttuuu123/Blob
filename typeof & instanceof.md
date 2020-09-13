`typeof`可以用来判断除了null以外的基本类型：

```javascript
typeof 1 // 'number'
typeof '1' // 'string'
typeof undefined // 'undefined'
typeof true // 'boolean'
typeof Symbol() // 'symbol'
```

`typeof`对于对象来说，除了函数都会显示`object`，所以说`typeof`并不能准确判断变量到底是什么类型。

```javascript
typeof [] // 'object'
typeof {} // 'object'
typeof console.log // 'function'
```

`instance`内部是用原型链来判断的：

```javascript
function Person {}
const person = new Person();
person instanceof Person; // true

const str = '1';
str instanceof String; // false

const anoStr = new String('');
anoStr instanceof String; // true
```

对于例子中的`str`，由于它是原始类型，不是`String`对象，不存在原型链，所以instanceof判断失败，</br>
但是ES6提供的内置的Symbol值`Symbol.hasInstance`：

> 对象的Symbol.hasInstance属性，指向一个内部方法。当其他对象使用instanceof运算符，判断是否为该对象的实例时，会调用这个方法。
> 比如，foo instanceof Foo在语言内部，实际调用的是Foo[Symbol.hasInstance](foo)。
>
> ```javascript
> class MyClass {
>   [Symbol.hasInstance](foo) {
>     return foo instanceof Array;
>   }
> }
>
> [1, 2, 3] instanceof new MyClass() // true
>
> class Even {
>   static [Symbol.hasInstance](obj) {
>     return Number(obj) % 2 === 0;
>   }
> }
>
> // 等同于
> const Even = {
>   [Symbol.hasInstance](obj) {
>     return Number(obj) % 2 === 0;
>   }
> };
>
> 1 instanceof Even // false
> 2 instanceof Even // true
> 12345 instanceof Even // false
> ```

