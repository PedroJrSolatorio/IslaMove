declare module 'lodash/debounce' {
  import {DebouncedFunc} from 'lodash';
  const debounce: DebouncedFunc<(...args: any[]) => any>;
  export default debounce;
}
