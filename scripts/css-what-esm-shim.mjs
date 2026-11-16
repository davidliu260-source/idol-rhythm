import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const cssWhat = require('../node_modules/css-what/lib/commonjs/index.js')
export const { AttributeAction, SelectorType, IgnoreCaseMode, parse, stringify, isTraversal } = cssWhat
export default cssWhat
