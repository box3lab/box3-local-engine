// DEPRECATED:  Use overlay.ts instead to ensure correct rendering order for 2d elements

import { vec4, vec3, mat4 } from 'gl-matrix';
import { REGLLoader } from './regl';

export default function (
  regl,
  reglLoader: REGLLoader,
  context2D?: CanvasRenderingContext2D,
) {
  const clipPos = vec4.create();
  const worldPos = vec4.create();
  return {
    text3D: (
      viewProj: mat4,
      text: string,
      position: vec3,
      options?: {
        size?: number;
        font?: string;
        color?: vec4 | vec3 | number[] | string;
        perspective?: boolean;
      },
    ) => {
      if (!context2D) {
        return;
      }
      worldPos[0] = position[0];
      worldPos[1] = position[1];
      worldPos[2] = position[2];
      worldPos[3] = 1;
      vec4.transformMat4(clipPos, worldPos, viewProj);
      if (
        -clipPos[3] < clipPos[0] &&
        clipPos[0] < clipPos[3] &&
        -clipPos[3] < clipPos[1] &&
        clipPos[1] < clipPos[3] &&
        -clipPos[3] < clipPos[2] &&
        clipPos[2] < clipPos[3]
      ) {
        const x = 0.5 * context2D.canvas.width * (1 + clipPos[0] / clipPos[3]);
        const y = 0.5 * context2D.canvas.height * (1 - clipPos[1] / clipPos[3]);
        let scale = context2D.canvas.height / 1024;
        if (options) {
          context2D.font = options.font || '12pt Sans-Serif';
          if (typeof options.color === 'string') {
            context2D.fillStyle = options.color;
          } else if (options.color) {
            if (options.color.length === 3) {
              context2D.fillStyle = `rgb(${Math.round(
                options.color[0] * 255,
              )}, ${Math.round(options.color[1] * 255)}, ${Math.round(
                options.color[2] * 255,
              )})`;
            } else if (options.color.length === 4) {
              context2D.fillStyle = `rgba(${Math.round(
                options.color[0] * 255,
              )}, ${Math.round(options.color[1] * 255)}, ${Math.round(
                options.color[2] * 255,
              )}, ${options.color[3]})`;
            }
          } else {
            context2D.fillStyle = '#000';
          }
          if (typeof options.size === 'number') {
            scale *= options.size;
          }
          if (options.perspective) {
            scale /= clipPos[3];
          }
        } else {
          context2D.font = '12pt Sans-Serif';
          context2D.fillStyle = '#000';
        }
        context2D.textAlign = 'center';
        context2D.textBaseline = 'middle';
        context2D.setTransform(scale, 0, 0, scale, 0, 0);
        context2D.beginPath();
        context2D.fillText(text, x / scale, y / scale);
      }
    },
  };
}
