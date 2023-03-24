import multiply from './modules/moduleB';
import plus from './modules/moduleC';
import { pick } from 'lodash';
import './index.css';
// 异步模块会单独打入一个chunk
const asyncContent = await import(/* webpackChunkName: 'asyncModule' */ './modules/asyncModule');
console.log(asyncContent)

multiply(1)(2)(3)(4)(5);
plus(1, 2)(3, 4)(5);

const a = {
  b: 1,
  c: 2
}
console.log(pick(a, 'b'));


const div = document.createElement('div');
div.setAttribute('class', 'block')
document.body.appendChild(div);