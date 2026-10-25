import typescript from '@rollup/plugin-typescript';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import eslint from '@rollup/plugin-eslint';
import svgr from '@svgr/rollup';

// node 16.15以下需要这段 workaround，升级镜像后可以换回标准的import
import { createRequire } from 'module'; // Bring in the ability to create the 'require' method
const r = createRequire(import.meta.url); // construct the require method
const pkg = r('./package.json'); // use the require method

export default [
  {
    external: [...Object.keys(pkg.dependencies)],
    input: './src/index.ts',
    output: [
      {
        dir: './build',
        preserveModules: true,
        preserveModulesRoot: 'src',
        sourcemap: true,
      },
    ],
    plugins: [
      eslint(),
      typescript({
        tsconfig: './tsconfig.json',
        noEmitOnError: false,
        emitDeclarationOnly: true,
      }),
      babel({
        presets: [
          '@babel/preset-typescript',
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
        extensions: ['.ts', '.tsx'],
      }),
      postcss({
        inject: true,
        modules: {
          generateScopedName: function (name, filename) {
            const splitFilename = filename.replace(/\\/g, '/').split('/');
            const componentName = splitFilename[splitFilename.length - 2];

            const nameList = [name];

            if (componentName !== name) {
              nameList.unshift(componentName);
            }

            /**
             * 处理成 box[Component][Name]驼峰命名方式
             */
            const list = nameList.map((str) =>
              str
                .replace(/(?:^\w|[A-Z]|\b\w)/g, (char) => char.toUpperCase())
                .replace(/-/g, ''),
            );

            list.unshift('box');

            return list.join('');
          },
        },
      }),
      svgr(),
    ],
  },
];
