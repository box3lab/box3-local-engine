import * as React from 'react';
import {
  UI3DStateSchema,
  UI3DElementSchema,
  UI3DMouseHandler,
  UI3DVoxelHandler,
  UI3DEntityHandler,
  UI3DEventHandlerNode,
  UI3DLineSchema,
  UI3DTextSchema,
  UI3DSphereSchema,
  UI3DConeSchema,
  UI3DQuadSchema,
  UI3DRingSchema,
  UI3DBoxSchema,
  UI3DMouseOutHandler,
  onContextMenuHandler,
  UI3DCursorIndicatorSchema,
  UI3DDirectionSignSchema,
  UI3DRingMouseHandler,
} from 'src/engine/ui3d/ui3d-schema';
import { vec3, mat4 } from 'gl-matrix';
import { MuSchema } from '@box/mudb/schema';
import { ConeGeometry } from './3d-shapes/ConeGeometry';
import { QuadGeometry } from './3d-shapes/QuadGeometry';
import { BoxGeometry, BoxWireFrameGeometry } from './3d-shapes/boxGeometry';
import { CylinderGeometry } from './3d-shapes/CylinderGeometry';
import { GameClientState } from 'src/engine/game-client-schema';
import { CursorIndicatorType as CursorIndicator } from 'src/engine/gl/ui3d';

export type CursorIndicatorType = CursorIndicator;
export const UI3DContext = React.createContext(UI3DStateSchema.identity);
export const UI3DContextConsumer = UI3DContext.Consumer;

export type UI3DContainerProps = {
  ui3D: GameClientState['ui3D'];
  children?: React.ReactNode;

  onVoxel?: UI3DVoxelHandler;
  onEntity?: UI3DEntityHandler;
  onContextMenu?: onContextMenuHandler;
  onClick?: UI3DMouseHandler;
  onDragStart?: UI3DMouseHandler;
  onDrag?: UI3DMouseHandler;
  onDragEnd?: UI3DMouseHandler;
};

export type UI3DContainerState = {};

export class UI3DContainer extends React.Component<
  UI3DContainerProps,
  UI3DContainerState
> {
  private _node: UI3DEventHandlerNode | null = null;

  public componentWillUnmount() {
    const ui3d = this.props.ui3D;
    if (this._node) {
      if (this._node === ui3d.eventHandlers) {
        ui3d.eventHandlers = this._node.next;
      }
      if (this._node.next) {
        this._node.next.prev = this._node.prev;
      }
      if (this._node.prev) {
        this._node.prev.next = this._node.next;
      }
      this._node = null;
    }
  }

  public render() {
    const ui3d = this.props.ui3D;
    if (!this._node) {
      this._node = new UI3DEventHandlerNode();
      this._node.next = ui3d.eventHandlers;
      if (this._node.next) {
        this._node.next.prev = this._node;
      }
      this._node.prev = null;
      ui3d.eventHandlers = this._node;
    }

    if (this._node) {
      this._node.onMouseEntity = this.props.onEntity || null;
      this._node.onMouseVoxel = this.props.onVoxel || null;
      this._node.onContextMenu = this.props.onContextMenu || null;
      this._node.onClick = this.props.onClick || null;
      this._node.onDragStart = this.props.onDragStart || null;
      this._node.onDrag = this.props.onDrag || null;
      this._node.onDragEnd = this.props.onDragEnd || null;
    }

    return (
      <UI3DContext.Provider value={this.props.ui3D}>
        {this.props.children}
      </UI3DContext.Provider>
    );
  }
}

export function UI3DContextWrapper<
  Props,
  ElementType extends keyof typeof UI3DElementSchema.muData,
  Schema extends MuSchema<any>,
>(
  schema: Schema,
  elementType: ElementType,
  factory: (
    element: (typeof UI3DElementSchema.muData)[ElementType]['identity'],
    props: Props,
    state: (typeof UI3DStateSchema)['identity'],
  ) => void,
) {
  const ContextInjector = (props: Props) => {
    const currElement = React.useRef<null | typeof UI3DElementSchema.identity>(
      undefined,
    );
    const context = React.useContext(UI3DContext);

    React.useEffect(() => {
      return () => {
        if (!currElement.current) {
          return;
        }
        currElement.current.data.destroyed = true;
        for (let i = 0; i < context.elements.length; i++) {
          if (context.elements[i].data.id === currElement.current.data.id) {
            context.elements.splice(i, 1);
            break;
          }
        }
        currElement.current = null;
      };
    }, [context]);

    const memo = React.useMemo(() => {
      if (currElement.current) {
        factory(currElement.current.data, props, context);
      } else {
        const element = UI3DElementSchema.alloc();
        element.type = elementType;
        const data = (element.data = schema.clone(schema.identity));
        data.id = context.idCounter++;
        data.destroyed = false;
        currElement.current = element;
        context.elements.push(element);
        factory(data, props, context);
      }
      return null;
    }, [context, props]);

    return memo;
  };
  return ContextInjector;
}

export const UI3DLine = UI3DContextWrapper(
  UI3DLineSchema,
  'line',
  (
    element,
    props: {
      start: vec3;
      end: vec3;
      color?: vec3;
      enableDepth?: boolean;
      visiable?: boolean;
      quadDetection?: boolean;
      isDragging?: boolean;
      width?: number;
      opacity?: number;
      fixedSize?: number;
      screenSizeFixed?: boolean;
      onDragStart?: UI3DMouseHandler;
      onMouse?: UI3DMouseHandler;
      onMouseIn?: UI3DMouseHandler;
      onMouseOut?: UI3DMouseOutHandler;
    },
    context,
  ) => {
    vec3.copy(element.start, props.start);
    vec3.copy(element.end, props.end);
    const { color, width, opacity } = props;
    if (color !== undefined) {
      vec3.copy(element.color, color);
    } else {
      vec3.set(element.color, 0, 0, 0);
    }
    if (opacity !== undefined) {
      element.opacity = opacity;
    } else {
      element.opacity = 1;
    }
    if (width !== undefined) {
      element.width = width;
    } else {
      element.width = 1;
    }
    if ('isDragging' in props) {
      element.isDragging = props.isDragging as boolean;
    } else {
      element.isDragging = false;
    }
    if ('quadDetection' in props) {
      element.quadDetection = props.quadDetection as boolean;
    } else {
      element.quadDetection = false;
    }
    if ('enableDepth' in props) {
      element.enableDepth = props.enableDepth as boolean;
    } else {
      element.enableDepth = false;
    }
    if ('visiable' in props && props.visiable !== undefined) {
      element.visiable = props.visiable;
    } else {
      element.visiable = true;
    }

    if ('screenSizeFixed' in props) {
      element.screenSizeFixed = props.screenSizeFixed as boolean;
    } else {
      element.screenSizeFixed = false;
    }
    if (props.fixedSize) {
      element.fixedSize = props.fixedSize as number;
    } else {
      element.fixedSize = 10.0;
    }
    if (props.onMouse) {
      element.onMouseChange = props.onMouse;
    } else {
      element.onMouseChange = null;
    }
    if (props.onDragStart) {
      element.onDragStart = props.onDragStart;
    } else {
      element.onDragStart = null;
    }
    if ('onMouseIn' in props && props.onMouseIn !== undefined) {
      element.onMouseIn = props.onMouseIn as UI3DMouseHandler;
    } else {
      element.onMouseIn = null;
    }
    if ('onMouseOut' in props && props.onMouseOut !== undefined) {
      element.onMouseOut = props.onMouseOut as UI3DMouseOutHandler;
    } else {
      element.onMouseOut = null;
    }
  },
);

export const UI3DDirectionSign = UI3DContextWrapper(
  UI3DDirectionSignSchema,
  'directionSign',
  (
    element,
    props: {
      start: vec3;
      end: vec3;
      color?: vec3;
      faceToEye?: boolean;
      normal?: vec3;
      width?: number;
      opacity?: number;
    },
    context,
  ) => {
    vec3.copy(element.start, props.start);
    vec3.copy(element.end, props.end);
    const { color, width, normal, faceToEye, opacity } = props;
    if (color !== undefined) {
      vec3.copy(element.color, color);
    } else {
      vec3.set(element.color, 0, 0, 0);
    }
    if (normal !== undefined) {
      vec3.copy(element.normal, normal);
    } else {
      vec3.set(element.normal, 0, 0, 0);
    }
    if (faceToEye !== undefined) {
      element.faceToEye = faceToEye === true ? 1 : 0;
    } else {
      element.faceToEye = 0;
    }
    if (width !== undefined) {
      element.width = width;
    } else {
      element.width = 1;
    }
    if (opacity !== undefined) {
      element.opacity = opacity;
    } else {
      element.opacity = 1;
    }
  },
);

export const UI3DText = UI3DContextWrapper(
  UI3DTextSchema,
  'text',
  (
    element,
    props: {
      position: vec3;
      text: string;

      perspective?: boolean;
      scale?: number;

      fill?: string;
      stroke?: string;
      font?: string;

      onMouse?: UI3DMouseHandler;
    },
    context,
  ) => {
    vec3.copy(element.position, props.position);
    element.text = props.text;
    element.perspective = !!props.perspective;
    if ('scale' in props) {
      element.scale = props.scale as number;
    } else {
      element.scale = 1;
    }
    if ('fill' in props) {
      element.fill = props.fill as string;
    } else {
      element.fill = '#000';
    }
    if ('font' in props) {
      element.font = props.font as string;
    } else {
      element.font = '12pt sans-serif';
    }
    if ('onMouse' in props) {
      element.onMouseChange = props.onMouse as UI3DMouseHandler;
    } else {
      element.onMouseChange = null;
    }
  },
);

export const UI3DPoint = UI3DContextWrapper(
  UI3DSphereSchema,
  'point',
  (
    element,
    props: {
      position: vec3;
      radius?: number;
      color?: vec3;
      onMouse?: UI3DMouseHandler;
    },
    context,
  ) => {
    vec3.copy(element.position, props.position);
    if ('color' in props) {
      vec3.copy(element.color, props.color as vec3);
    } else {
      vec3.set(element.color, 0, 0, 0);
    }
    if ('radius' in props) {
      element.radius = props.radius as number;
    } else {
      element.radius = 1;
    }
    if ('onMouse' in props) {
      element.onMouseChange = props.onMouse as UI3DMouseHandler;
    } else {
      element.onMouseChange = null;
    }
  },
);

export const UI3DCone = UI3DContextWrapper(
  UI3DConeSchema,
  'cone',
  (
    element,
    props: {
      height: number;
      cosA: number;
      color?: vec3;
      offset?: vec3;
      position: vec3;
      enableDepth?: boolean;
      radialSegments?: number;
      axis: string;
      fixedSize?: number;
      screenSizeFixed?: boolean;
      onMouse?: UI3DMouseHandler;
      onDragStart?: UI3DMouseHandler;
    },
    context,
  ) => {
    let newCone = false;
    if (element.vertices.length === 0) {
      newCone = true;
    }
    if (element.height !== props.height) {
      element.height = props.height;
      newCone = true;
    }
    if (element.cosA !== props.cosA) {
      element.cosA = props.cosA;
      newCone = true;
    }
    if (element.radialSegments !== (props.radialSegments || 8)) {
      element.radialSegments = props.radialSegments || 8;
      newCone = true;
    }
    if ('enableDepth' in props) {
      element.enableDepth = props.enableDepth as boolean;
    } else {
      element.enableDepth = false;
    }
    if ('color' in props) {
      vec3.copy(element.color, props.color as vec3);
    } else {
      vec3.set(element.color, 0, 0, 0);
    }

    if (newCone) {
      const cone = ConeGeometry(
        props.cosA,
        props.height,
        element.radialSegments,
      );
      element.vertices = cone.vertices;
      element.indices = cone.indices;
      element.normals = cone.normals;
    }
    if (
      !(
        element.position !== undefined &&
        vec3.equals(element.position, props.position)
      )
    ) {
      vec3.copy(element.position, props.position);
      mat4.identity(element.translateMat);
      mat4.translate(
        element.translateMat,
        element.translateMat,
        props.position as vec3,
      );
    }
    if (props.offset) {
      vec3.copy(element.offset, props.offset as vec3);
    } else {
      vec3.set(element.offset, 0, 0, 0);
    }
    element.axis = props.axis;
    mat4.identity(element.rotateMat);
    if (props.axis === 'x') {
      mat4.rotate(
        element.rotateMat,
        element.rotateMat,
        -0.5 * Math.PI,
        [0, 0, 1],
      );
    } else if (props.axis === 'y') {
      // mat4.rotate(element.rotate, element.rotate, 0, [1, 0, 0]);
    } else if (props.axis === 'z') {
      mat4.rotate(
        element.rotateMat,
        element.rotateMat,
        0.5 * Math.PI,
        [1, 0, 0],
      );
    }
    if ('screenSizeFixed' in props) {
      element.screenSizeFixed = props.screenSizeFixed as boolean;
    } else {
      element.screenSizeFixed = true;
    }
    if (props.fixedSize) {
      element.fixedSize = props.fixedSize as number;
    } else {
      element.fixedSize = 10.0;
    }
    if ('onMouse' in props) {
      element.onMouseChange = props.onMouse as UI3DMouseHandler;
    } else {
      element.onMouseChange = null;
    }
    if ('onDragStart' in props) {
      element.onDragStart = props.onDragStart as UI3DMouseHandler;
    } else {
      element.onDragStart = null;
    }
  },
);

export const UI3DCursorIndicator = UI3DContextWrapper(
  UI3DCursorIndicatorSchema,
  'cursorIndicator',
  (
    element,
    props: {
      position: vec3;
      offset?: vec3;
      normal: vec3;
      radius?: number;
      type: CursorIndicatorType;
    },
    context,
  ) => {
    let newIndicator = false;
    if (element.vertices.length === 0) {
      newIndicator = true;
    }
    if (!vec3.equals(element.normal, props.normal)) {
      vec3.copy(element.normal, props.normal);
      newIndicator = true;
    }
    element.type = props.type;
    const r = props.radius || 1;
    if (element.radius !== r) {
      element.radius = r;
      newIndicator = true;
    }
    if (newIndicator) {
      const q = QuadGeometry(element.normal, element.radius);
      element.vertices = q.vertices;
      element.indices = q.indices;
      element.uv = q.uv;
    }
    if ('offset' in props && props.offset !== undefined) {
      vec3.copy(element.offset, props.offset as vec3);
    } else {
      vec3.set(element.offset, 0, 0, 0);
    }
    if (!vec3.equals(element.center, props.position)) {
      vec3.copy(element.center, props.position);
      mat4.identity(element.translateMat);
      mat4.translate(
        element.translateMat,
        element.translateMat,
        element.center,
      );
    }
  },
);

export const UI3DQuad = UI3DContextWrapper(
  UI3DQuadSchema,
  'quad',
  (
    element,
    props: {
      normal: vec3;
      color?: vec3;
      fence?: number;
      radius?: number;
      opacity?: number;
      enableDepth?: boolean;
      isDragging?: boolean;
      position: vec3;
      offset?: vec3;
      fixedSize?: number;
      screenSizeFixed?: boolean;
      onMouse?: UI3DMouseHandler;
      onMouseIn?: UI3DMouseHandler;
      onMouseOut?: UI3DMouseOutHandler;
    },
    context,
  ) => {
    let newQuad = false;
    if (element.vertices.length === 0) {
      newQuad = true;
    }
    if (!vec3.equals(element.normal, props.normal)) {
      vec3.copy(element.normal, props.normal);
      newQuad = true;
    }
    const r = props.radius || 1;
    if (element.radius !== r) {
      element.radius = r;
      newQuad = true;
    }
    if (newQuad) {
      const q = QuadGeometry(element.normal, element.radius);
      element.vertices = q.vertices;
      element.indices = q.indices;
      element.uv = q.uv;
    }
    if (props.opacity !== undefined) {
      element.opacity = props.opacity;
    } else {
      element.opacity = 1;
    }
    if ('color' in props && props.color !== undefined) {
      vec3.copy(element.color, props.color as vec3);
    } else {
      vec3.set(element.color, 0.94, 0.94, 0.94);
    }
    if (!vec3.equals(element.center, props.position)) {
      vec3.copy(element.center, props.position);
      mat4.identity(element.translateMat);
      mat4.translate(
        element.translateMat,
        element.translateMat,
        element.center,
      );
    }
    if ('fence' in props && props.fence !== undefined) {
      element.fence = props.fence;
    } else {
      element.fence = 0;
    }
    if ('enableDepth' in props) {
      element.enableDepth = props.enableDepth as boolean;
    } else {
      element.enableDepth = false;
    }
    if ('isDragging' in props && props.isDragging !== undefined) {
      element.isDragging = props.isDragging as boolean;
    } else {
      element.isDragging = false;
    }
    if ('screenSizeFixed' in props && props.screenSizeFixed !== undefined) {
      element.screenSizeFixed = props.screenSizeFixed as boolean;
    } else {
      element.screenSizeFixed = true;
    }
    if (props.fixedSize) {
      element.fixedSize = props.fixedSize as number;
    } else {
      element.fixedSize = 10.0;
    }
    if ('offset' in props && props.offset !== undefined) {
      vec3.copy(element.offset, props.offset as vec3);
    } else {
      vec3.set(element.offset, 0, 0, 0);
    }
    if ('onMouse' in props) {
      element.onMouseChange = props.onMouse as UI3DMouseHandler;
    } else {
      element.onMouseChange = null;
    }
    if ('onMouseIn' in props && props.onMouseIn !== undefined) {
      element.onMouseIn = props.onMouseIn as UI3DMouseHandler;
    } else {
      element.onMouseIn = null;
    }
    if ('onMouseOut' in props && props.onMouseOut !== undefined) {
      element.onMouseOut = props.onMouseOut as UI3DMouseOutHandler;
    } else {
      element.onMouseOut = null;
    }
  },
);

export const UI3DRing = UI3DContextWrapper(
  UI3DRingSchema,
  'ring',
  (
    element,
    props: {
      startRad: number;
      endRad: number;
      clockwise?: boolean;
      enableDepth?: boolean;
      highlight?: boolean;
      normal: vec3;
      color?: vec3;
      fillColor?: vec3;
      radius?: number;
      position: vec3;
      offset?: vec3;
      fixedSize?: number;
      screenSizeFixed?: boolean;
      onMouse?: UI3DRingMouseHandler;
      onDragStart?: UI3DRingMouseHandler;
      onMouseIn?: UI3DMouseHandler;
      onMouseOut?: UI3DMouseOutHandler;
    },
    context,
  ) => {
    let newRing = false;
    if (
      element.vertices.length === 0 ||
      element.cylinderVertices.length === 0
    ) {
      newRing = true;
    }
    if (!vec3.equals(element.normal, props.normal)) {
      vec3.copy(element.normal, props.normal);
      newRing = true;
    }
    const r = props.radius || 1;
    if (element.radius !== r) {
      element.radius = r;
      newRing = true;
    }
    if (newRing) {
      const q = QuadGeometry(element.normal, element.radius * 100);
      const c = CylinderGeometry(
        element.normal,
        element.radius,
        element.radius,
        0.02,
        50,
        1,
        true,
        0,
        2 * Math.PI,
      );
      element.vertices = q.vertices;
      element.indices = q.indices;
      element.uv = q.uv;
      element.cylinderVertices = c.vertices;
      element.cylinderIndices = c.indices;
      element.cylinderUv = c.uvs;
      vec3.copy(element.uv_x, q.uv_x);
      vec3.copy(element.uv_y, q.uv_y);
    }
    if ('enableDepth' in props) {
      element.enableDepth = props.enableDepth as boolean;
    } else {
      element.enableDepth = false;
    }
    if (props.color) {
      vec3.copy(element.color, props.color);
    } else {
      vec3.set(element.color, 0.94, 0.94, 0.94);
    }
    if (props.fillColor) {
      vec3.copy(element.fillColor, props.fillColor);
    } else {
      vec3.set(element.fillColor, 0.94, 0.94, 0.94);
    }
    if (!vec3.equals(element.center, props.position)) {
      vec3.copy(element.center, props.position);
      mat4.identity(element.translateMat);
      mat4.translate(
        element.translateMat,
        element.translateMat,
        element.center,
      );
    }
    if (props.highlight) {
      element.highlight = props.highlight;
    } else {
      element.highlight = false;
    }
    element.startRad = props.startRad;
    element.currentRad = props.endRad;
    if (props.clockwise) {
      element.clockwise = props.clockwise;
    } else {
      element.clockwise = false;
    }
    if ('screenSizeFixed' in props && props.screenSizeFixed !== undefined) {
      element.screenSizeFixed = props.screenSizeFixed as boolean;
    } else {
      element.screenSizeFixed = true;
    }
    if (props.fixedSize) {
      element.fixedSize = props.fixedSize as number;
    } else {
      element.fixedSize = 10.0;
    }
    if ('offset' in props && props.offset !== undefined) {
      vec3.copy(element.offset, props.offset as vec3);
    } else {
      vec3.set(element.offset, 0, 0, 0);
    }
    if ('onMouse' in props && props.onMouse !== undefined) {
      element.onMouseChange = props.onMouse;
    } else {
      element.onMouseChange = null;
    }
    if ('onDragStart' in props && props.onDragStart !== undefined) {
      element.onDragStart = props.onDragStart;
    } else {
      element.onDragStart = null;
    }
    if ('onMouseIn' in props && props.onMouseIn !== undefined) {
      element.onMouseIn = props.onMouseIn as UI3DMouseHandler;
    } else {
      element.onMouseIn = null;
    }
    if ('onMouseOut' in props && props.onMouseOut !== undefined) {
      element.onMouseOut = props.onMouseOut as UI3DMouseOutHandler;
    } else {
      element.onMouseOut = null;
    }
  },
);

export const UI3DBox = UI3DContextWrapper(
  UI3DBoxSchema,
  'box',
  (
    element,
    props: {
      centerAtBottom?: boolean;
      opacity?: number;
      enableDepth?: boolean;
      color?: vec3;
      lineColor?: vec3;
      dimension?: vec3;
      line?: boolean;
      position: vec3;
      offset?: vec3;
      fixedSize?: number;
      screenSizeFixed?: boolean;
      onMouse?: UI3DMouseHandler;
      onMouseIn?: UI3DMouseHandler;
      onMouseOut?: UI3DMouseOutHandler;
      onDragStart?: UI3DMouseHandler;
    },
    context,
  ) => {
    if (element.vertices.length === 0) {
      const boxGeo = BoxGeometry();
      element.vertices = boxGeo.vertices;
      element.uv = boxGeo.uvs;
    }
    if (!!props.line !== element.wireFrame) {
      element.wireFrame = !!props.line;
      if (element.wireFrame) {
        element.lines = BoxWireFrameGeometry();
      } else {
        element.lines = [];
      }
    }
    element.centerAtBottom = !!props.centerAtBottom as boolean;
    if (props.dimension) {
      vec3.copy(element.dimension, props.dimension);
    } else {
      vec3.set(element.dimension, 1, 1, 1);
    }
    if (props.opacity !== undefined) {
      element.opacity = props.opacity;
    } else {
      element.opacity = 1;
    }
    if (props.color) {
      vec3.copy(element.color, props.color);
    } else {
      vec3.set(element.color, 0.012, 0.776, 0.957);
    }
    if (props.lineColor) {
      vec3.copy(element.wireFrameColor, props.lineColor);
    } else {
      vec3.set(element.wireFrameColor, 0.0, 0.0, 0.0);
    }
    if (!vec3.equals(element.position, props.position)) {
      vec3.copy(element.position, props.position);
      mat4.identity(element.translateMat);
      mat4.translate(
        element.translateMat,
        element.translateMat,
        element.position,
      );
    }
    if (props.offset) {
      vec3.copy(element.offset, props.offset);
    } else {
      vec3.set(element.offset, 0, 0, 0);
    }
    if ('enableDepth' in props) {
      element.enableDepth = props.enableDepth as boolean;
    } else {
      element.enableDepth = false;
    }
    if (props.fixedSize) {
      element.fixedSize = props.fixedSize;
    } else {
      element.fixedSize = 10.0;
    }
    if ('screenSizeFixed' in props && props.screenSizeFixed !== undefined) {
      element.screenSizeFixed = props.screenSizeFixed as boolean;
    } else {
      element.screenSizeFixed = true;
    }
    if (props.onMouse) {
      element.onMouseChange = props.onMouse as UI3DMouseHandler;
    } else {
      element.onMouseChange = null;
    }
    if (props.onDragStart) {
      element.onDragStart = props.onDragStart;
    } else {
      element.onDragStart = null;
    }
    if ('onMouseIn' in props && props.onMouseIn !== undefined) {
      element.onMouseIn = props.onMouseIn as UI3DMouseHandler;
    } else {
      element.onMouseIn = null;
    }
    if ('onMouseOut' in props && props.onMouseOut !== undefined) {
      element.onMouseOut = props.onMouseOut as UI3DMouseOutHandler;
    } else {
      element.onMouseOut = null;
    }
  },
);
