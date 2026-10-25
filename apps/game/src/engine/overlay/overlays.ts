import { vec4, vec3, vec2 } from 'gl-matrix';
import { GameClientState } from '../game-client-schema';
import {
  OverlayListSchema,
  TextOverlaySchema,
  TextOverlay,
  OverlaySchema,
  BloodStripOverlaySchema,
  BloodStripOverlay,
  StyleNumberOverlaySchema,
  StyleNumberOverlay,
  PlayerIndicatorSchema,
  PlayerIndicatorOverlay,
  InteractUIOverlay,
} from './overlay-schema';
import { zipId } from '@box/utils/id';
import { ENGINE_RES } from '../../resource/engine';
import {
  retrieveWithImage,
  type ImageRequest,
} from '@box/content-server/image';
import { MsgType, StickMessage } from '@box/schema/chat/chat-schema';
import { isMobile } from '../../utils/mobile';
import { INDICATOR_RES } from '../../resource/indicator';
import { INTERACTIVE_RES } from '../../resource/interactive';
import {
  clipPosToScreenPos,
  worldPosToClipPos,
} from '../camera/camera-controller';
import { CUTOFF_FAR, raycastEye } from '../utils/raycast-eye';
import {
  getTextBoxWidth,
  getTextBoxHeight,
  wrapTextBreakWord,
} from '../utils/canvas';
import {
  DisposalMethod,
  FrameData,
  parseGIF,
  parseGIFInfo,
} from '../gl/gif-parser';
import type { ChatBubble, GIFInfoType } from '../chat/chat-client-schema';
import { getCanvas2DContext } from '../utils/device';
import { isShowPlayerName } from './player-overlay';
import {
  RenderBox,
  OverlayInfoVisibleScaleEnum,
} from '@box/schema/render-box/schema';

const style_number: ImageRequest[] = [];
const indicators: { [key: string]: ImageRequest } = {};
const interactive: { [key: string]: ImageRequest } = {};

const CLIP_POS = vec3.create();
const SCREEN_POS = vec2.create();

/**
 * 交互按钮动效的时长
 */
export const INTERACT_ANIM_TIME = 3000;
/**
 * 交互按钮icon尺寸
 */
const INTERACTIVE_ICON_SIZE = 48;

/**
 * 表情包最大宽高
 */
const MAX_STICKER = 64;

const hasDocument = typeof document !== 'undefined';

export const INDICATOR_Y_OFFSET = 0.3;
/**
 * 实体信息之间的间距(2D) 例如：
 ** 血条与交互信息的间距
 ** 交互信息与实体名称的间距
 ** 特殊地：聊天气泡具有特殊形状 其下方无需额外处理间距
 */
export const BASE_2D_OFFSET_Y = 3;
/**
 * 实体与上方的实体信息间距(2D)
 */
export const ENTITY_INFO_2D_OFFSET_Y = 9;
/**
 * 实体名称占位(2D)
 */
export const ENTITY_NAME_2D_OFFSET_Y = 16;
/**
 * 交互文案占位(2D)
 */
export const INTERACT_2D_OFFSET_Y = 14;
/**
 * 血条占位(2D)
 */
export const BLOOD_STRIP_2D_OFFSET_Y = 12;
/**
 * 玩家名称占位(2D)
 */
export const PLAYER_NAME_2D_OFFSET_Y = 20;

export function initDamageNumbers(state: GameClientState) {
  for (let i = 0; i < 10; ++i) {
    style_number.push(
      state.content.fetchImage(ENGINE_RES.damageNumbers[i], retrieveWithImage),
    );
  }
}

export function initImages(state: GameClientState) {
  for (const i in INDICATOR_RES) {
    indicators[i] = state.content.fetchImage(
      INDICATOR_RES[i],
      retrieveWithImage,
    );
  }
  for (const i in INTERACTIVE_RES) {
    interactive[i] = state.content.fetchImage(
      INTERACTIVE_RES[i],
      retrieveWithImage,
    );
  }
}

const style_number_width = [23, 16, 25, 23, 25, 25, 25, 23, 26, 26];
const style_number_height = 30;

export function drawStyleNumber(
  state: GameClientState,
  text: string,
  position: vec3 | number[] | [number, number, number],
  options?: {
    /**
     * 视窗高度缩放倍率
     * 默认值：以1024为标准计算高度缩放倍率
     */
    windowHeightScale?: number;
  },
) {
  const context2D = state.overlays.context;
  if (!context2D) {
    return;
  }
  worldPos[0] = position[0];
  worldPos[1] = position[1];
  worldPos[2] = position[2];
  worldPos[3] = 1;

  vec4.transformMat4(clipPos, worldPos, state.camera.viewProjection);
  if (
    -clipPos[3] < clipPos[0] &&
    clipPos[0] < clipPos[3] &&
    -clipPos[3] < clipPos[1] &&
    clipPos[1] < clipPos[3] &&
    -clipPos[3] < clipPos[2] &&
    clipPos[2] < clipPos[3]
  ) {
    const styleNumberOverlay = StyleNumberOverlaySchema.alloc();
    styleNumberOverlay.x =
      0.5 * context2D.canvas.width * (1 + clipPos[0] / clipPos[3]);
    styleNumberOverlay.y =
      0.5 * context2D.canvas.height * (1 - clipPos[1] / clipPos[3]);
    styleNumberOverlay.scale = context2D.canvas.height / 1024;
    styleNumberOverlay.text = text;
    if (options) {
      if (options.windowHeightScale !== undefined) {
        styleNumberOverlay.scale = options.windowHeightScale;
      }
    }
    const entry = OverlaySchema.alloc();
    entry.type = 'styleNumber';
    entry.data = styleNumberOverlay;
    state.overlays.overlays.push(entry);
  }
}

const TMP = vec3.create();

export function drawBubble(state: GameClientState, scale: number) {
  const context2D = state.overlays.context;
  if (!context2D) {
    return;
  }
  zipId(
    (player, box) => {
      if (isShowPlayerName(state, player)) {
        updateVisibilityAndScale(state, box);
        if (!box.overlayInfoVisibleScale) {
          return;
        }
        box.playerChatBubbleOffsetY +=
          PLAYER_NAME_2D_OFFSET_Y * box.overlayInfoVisibleScale; // 玩家名称的占位
      }
    },
    state.replica.players,
    state.renderBoxes,
  );
  zipId(
    (bubble, box) => {
      updateVisibilityAndScale(state, box);
      if (!box.overlayInfoVisibleScale) {
        return;
      }
      TMP[0] = box.px;
      TMP[1] = box.py + box.ry;
      TMP[2] = box.pz;
      worldPosToClipPos(CLIP_POS, TMP, state.camera);
      const { width, height } = context2D.canvas;
      const isVisible = clipPosToScreenPos(SCREEN_POS, CLIP_POS, {
        width,
        height,
        top: 0,
        left: 0,
      });
      if (!isVisible) {
        return;
      }
      const content = computeBubbleContent(state, context2D, bubble);
      if (!content) {
        return;
      }
      // 气泡下方 其他内容占据的2D高度
      let offsetY =
        (box.overlayOffsetY + (box.playerChatBubbleOffsetY || 0)) * scale;
      drawChatBox(
        context2D,
        SCREEN_POS[0],
        SCREEN_POS[1],
        content,
        offsetY,
        scale * box.overlayInfoVisibleScale,
      );
    },
    state.chatBubble,
    state.renderBoxes,
  );
}

const RADIUS = 8;
const TRIANGLE_HALF_WIDTH = 16 / 2;
const TRIANGLE_HEIGHT = 8;
function drawRoundedRectangle(
  context2D: CanvasRenderingContext2D,
  param: {
    center: {
      x: number;
      y: number;
    };
    halfWidth: number;
    halfHeight: number;
    radius?: number;
    triangleHalfWidth?: number;
    triangleHeight?: number;
  },
) {
  const {
    center,
    halfHeight,
    halfWidth,
    radius = RADIUS,
    triangleHalfWidth = TRIANGLE_HALF_WIDTH,
    triangleHeight = TRIANGLE_HEIGHT,
  } = param;
  const { x, y } = center;
  context2D.fillStyle = '#00000099';
  context2D.beginPath();

  // 起点为左上角刨除圆弧的点
  context2D.moveTo(x - halfWidth + radius, y - halfHeight);
  context2D.lineTo(x + halfWidth - radius, y - halfHeight);
  // 右上角圆弧
  context2D.arcTo(
    x + halfWidth,
    y - halfHeight,
    x + halfWidth,
    y - halfHeight + radius,
    radius,
  );
  context2D.lineTo(x + halfWidth, y + halfHeight - radius);
  // 右下角圆弧
  context2D.arcTo(
    x + halfWidth,
    y + halfHeight,
    x + halfWidth - radius,
    y + halfHeight,
    radius,
  );
  // 向下的三角形
  context2D.lineTo(x + triangleHalfWidth, y + halfHeight);
  context2D.lineTo(x, y + halfHeight + triangleHeight);
  context2D.lineTo(x - triangleHalfWidth, y + halfHeight);
  context2D.lineTo(x - halfWidth + radius, y + halfHeight);
  // 左下角圆弧
  context2D.arcTo(
    x - halfWidth,
    y + halfHeight,
    x - halfWidth,
    y + halfHeight - radius,
    radius,
  );
  context2D.lineTo(x - halfWidth, y - halfHeight + radius);
  // 左上角圆弧
  context2D.arcTo(
    x - halfWidth,
    y - halfHeight,
    x - halfWidth + radius,
    y - halfHeight,
    radius,
  );
  context2D.fill();
  context2D.closePath();
}

const PADDING_HEIGHT = 8 * 2;
const PADDING_WIDTH = 16 * 2;
const LINE_HEIGHT_PADDING = 4 * 2;
const MAX_WIDTH = 400;
function drawChatBox(
  context2D: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  content: BubbleContent,
  offsetY: number,
  /**
   * 缩放倍率 = 高度缩放倍率 * 摄像机距离产生的缩放倍率
   */
  chatBoxScale: number,
) {
  const { boxWidth, boxHeight, drawContent } = content;
  const halfWidth = boxWidth / 2;
  const halfHeight = boxHeight / 2;
  const x = screenX / chatBoxScale;
  const y = (screenY - offsetY) / chatBoxScale - TRIANGLE_HEIGHT - halfHeight;

  context2D.setTransform(chatBoxScale, 0, 0, chatBoxScale, 0, 0);
  drawRoundedRectangle(context2D, {
    center: {
      x,
      y,
    },
    halfHeight,
    halfWidth,
  });

  drawContent(x, y);
}

let GIF_CONTEXT: CanvasRenderingContext2D | null;
let TEMP_CONTEXT: CanvasRenderingContext2D | null;
if (hasDocument) {
  GIF_CONTEXT = getCanvas2DContext().context;
  TEMP_CONTEXT = getCanvas2DContext().context;
}

type BubbleContent = {
  boxWidth: number;
  boxHeight: number;
  drawContent: (x: number, y: number) => void;
};
function computeBubbleContent(
  state: GameClientState,
  context2D: CanvasRenderingContext2D,
  bubble: ChatBubble,
): BubbleContent | undefined {
  if (bubble.msgType === MsgType.txt) {
    context2D.font = `16px Montserrat-Regular`;
    context2D.textAlign = 'center';
    const texts = wrapTextBreakWord(
      context2D,
      bubble.message,
      MAX_WIDTH - PADDING_WIDTH,
      2,
    );
    const textMetrics = context2D.measureText(bubble.message);
    const lineWidth = getTextBoxWidth(textMetrics);
    const lineHeight = getTextBoxHeight(textMetrics) + LINE_HEIGHT_PADDING;

    const boxWidth = Math.min(lineWidth + PADDING_WIDTH, MAX_WIDTH);
    const boxHeight = lineHeight * texts.length + PADDING_HEIGHT;
    return {
      boxWidth,
      boxHeight,
      drawContent: (x, y) => {
        context2D.fillStyle = '#FFFFFF';
        const textY = y - boxHeight / 2 + PADDING_HEIGHT / 2 + lineHeight / 2;
        for (let i = 0; i < texts.length; i++) {
          context2D.fillText(texts[i], x, textY + lineHeight * i);
        }
      },
    };
  }

  if (bubble.msgType === MsgType.sticker) {
    if (bubble.gifInfo) {
      if (hasDocument) {
        return drawWebGIFSticker(state, context2D, bubble.gifInfo);
      }

      if (process.env.RUSTY) {
        return drawRustyGIFSticker(state, context2D, bubble.gifInfo);
      }

      return;
    }

    try {
      const sticker: StickMessage = JSON.parse(bubble.message);
      const img = state.content.fetchImage(
        state.overlays.stickerPackList[sticker.themeId][sticker.stickerId].url,
        retrieveWithImage,
      );
      if (!img.image || !img.loaded) {
        return;
      }
      const image = img.image;
      const { width, height } = image;
      const { boxWidth, boxHeight, contentWidth, contentHeight } =
        getStickerSize(width, height);
      return {
        boxWidth,
        boxHeight,
        drawContent: (x, y) => {
          context2D.drawImage(
            image,
            x - contentWidth / 2,
            y - contentHeight / 2,
            contentWidth,
            contentHeight,
          );
        },
      };
    } catch (err) {
      console.error('error when parse sticker message', err);
      return;
    }
  }

  return;
}

function drawWebGIFSticker(
  state: GameClientState,
  context2D: CanvasRenderingContext2D,
  gifInfo: GIFInfoType,
) {
  if (!GIF_CONTEXT || !TEMP_CONTEXT) {
    return;
  }
  const parsedGIF = getParsedGIF(state, gifInfo.url, true);
  if (!parsedGIF) {
    return;
  }
  const { frames, width, height } = parsedGIF;

  // 清空并重新调整GIF的尺寸
  GIF_CONTEXT.clearRect(
    0,
    0,
    GIF_CONTEXT.canvas.width,
    GIF_CONTEXT.canvas.height,
  );
  GIF_CONTEXT.canvas.width = width;
  GIF_CONTEXT.canvas.height = height;

  // 绘制当前帧数据
  const frame = frames[gifInfo.frameIndex];
  TEMP_CONTEXT.clearRect(
    0,
    0,
    TEMP_CONTEXT.canvas.width,
    TEMP_CONTEXT.canvas.height,
  );
  TEMP_CONTEXT.canvas.width = frame.width;
  TEMP_CONTEXT.canvas.height = frame.height;
  TEMP_CONTEXT.putImageData(frame.imageData, 0, 0);

  // 当绘制方法不为空时，如果有上一帧的数据，先绘制上一帧的数据
  if (gifInfo.imageData && frame.disposalMethod !== DisposalMethod.None) {
    GIF_CONTEXT.putImageData(gifInfo.imageData, 0, 0);
  }

  // 当绘制方法是恢复到当前背景颜色时候，绘制当前帧的背景颜色
  if (frame.disposalMethod === DisposalMethod.RestoreToBackground) {
    GIF_CONTEXT.beginPath();
    // 先擦除这一块的颜色再绘制背景颜色
    // 因为背景有可能是透明的，但又不想透过原本上一帧的颜色
    GIF_CONTEXT.globalCompositeOperation = 'destination-out';
    GIF_CONTEXT.fillRect(frame.left, frame.top, frame.width, frame.height);
    // 恢复覆盖绘制模式，画背景色
    GIF_CONTEXT.globalCompositeOperation = 'source-over';
    const [r, g, b, a] = frame.backgroundColor;
    GIF_CONTEXT.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    GIF_CONTEXT.fillRect(frame.left, frame.top, frame.width, frame.height);
    GIF_CONTEXT.closePath();
  }

  // 将当前帧数据覆盖绘制
  GIF_CONTEXT.drawImage(
    TEMP_CONTEXT.canvas,
    0,
    0,
    frame.width,
    frame.height,
    frame.left,
    frame.top,
    frame.width,
    frame.height,
  );
  // 记录当前帧数据
  gifInfo.imageData = GIF_CONTEXT.getImageData(0, 0, width, height);

  updateGIFInfo(gifInfo, frames, state.clock.clock);

  const { boxHeight, boxWidth, contentHeight, contentWidth } = getStickerSize(
    width,
    height,
  );

  return {
    boxWidth,
    boxHeight,
    drawContent: (x, y) => {
      context2D.drawImage(
        GIF_CONTEXT.canvas,
        x - contentWidth / 2,
        y - contentHeight / 2,
        contentWidth,
        contentHeight,
      );
    },
  };
}

/**
 * 在rusty上，直接用image绘制gif
 * TODO 当前没有播放效果，待实现
 */
function drawRustyGIFSticker(
  state: GameClientState,
  context2D: CanvasRenderingContext2D,
  gifInfo: GIFInfoType,
) {
  const parsedGIF = getParsedGIF(state, gifInfo.url, false);

  // TODO 以后可以考虑优化，让安卓完成资源拉取 + 解析gif信息
  // 需要额外通过HTMLImageElement发起请求，这样rusty_box的安卓才会去拉取资源
  const imgRequest = state.content.fetchImage(gifInfo.url, retrieveWithImage);

  if (
    !parsedGIF ||
    !imgRequest.loaded ||
    !imgRequest.image ||
    !(imgRequest.image instanceof HTMLImageElement)
  ) {
    return;
  }

  const { frameIndex } = gifInfo;
  const { image } = imgRequest;

  updateGIFInfo(gifInfo, parsedGIF.frames, state.clock.clock);

  const { boxHeight, boxWidth, contentHeight, contentWidth } = getStickerSize(
    image.width,
    image.height,
  );

  return {
    boxWidth,
    boxHeight,
    drawContent: (x, y) => {
      window.rustyDrawGIF?.(
        image,
        frameIndex,
        x - contentWidth / 2,
        y - contentHeight / 2,
        contentWidth,
        contentHeight,
      );
    },
  };
}

function updateGIFInfo(out: GIFInfoType, frames: FrameData[], tick: number) {
  // 绘制当前帧数据
  const frame = frames[out.frameIndex];

  if (!out.startTick) {
    out.startTick = tick;
  }
  if (!out.frameStartTick) {
    out.frameStartTick = tick;
  }

  // 每一帧停留时间为delayTime毫秒，如果超过时间则进入下一帧
  if (tick - out.frameStartTick > frame.delayTime) {
    // 如果已经播放完成了，重新播放，一共播放三次
    if (out.frameIndex + 1 >= frames.length) {
      out.cycleCount--;
      out.frameIndex = 0;
      out.imageData = null;
    } else {
      out.frameIndex++;
    }
    out.frameStartTick = tick;
  }

  return out;
}

function getStickerSize(imgWidth: number, imgHeight: number) {
  const size = Math.max(imgWidth, imgHeight);
  const radio = size > MAX_STICKER ? MAX_STICKER / size : 1;
  const contentWidth = imgWidth * radio;
  const contentHeight = imgHeight * radio;

  const boxWidth = contentWidth + PADDING_WIDTH;
  const boxHeight = contentHeight + PADDING_HEIGHT;
  return {
    contentWidth,
    contentHeight,
    boxHeight,
    boxWidth,
  };
}

/**
 * 请求以及解析gif数据，会缓存起来
 * @param state 游戏客户端状态
 * @param gifUrl gif图地址
 * @param parseImageData 是否解析图片像素数据
 */
function getParsedGIF(
  state: GameClientState,
  gifUrl: string,
  parseImageData: boolean,
) {
  if (gifUrl in state.overlays.gifCache) {
    return state.overlays.gifCache[gifUrl];
  }

  state.overlays.gifCache[gifUrl] = null;
  state.content.retrieveFromS3(gifUrl).then((data) => {
    if (!data) {
      return;
    }

    state.overlays.gifCache[gifUrl] = parseImageData
      ? parseGIF(data)
      : parseGIFInfo(data);
  });
  return;
}

export function clearOverlay(state: GameClientState) {
  // Clear canvas
  const context2d = state.overlays.context;
  if (!context2d) {
    return;
  }
  context2d.setTransform(1, 0, 0, 1, 0, 0);
  context2d.clearRect(0, 0, context2d.canvas.width, context2d.canvas.height);
}

interface HasZIndex {
  type: string;
  data: {
    zIndex: number;
  };
}

function compareOverlays(a: HasZIndex, b: HasZIndex) {
  return a.data.zIndex - b.data.zIndex;
}

const PI_2 = Math.PI / 2;
export function renderOverlays(state: GameClientState) {
  const context2d = state.overlays.context;
  if (!context2d) {
    return;
  }

  // Render all overlays
  const overlays = state.overlays.overlays.sort(compareOverlays);
  for (let i = 0; i < overlays.length; ++i) {
    const o = overlays[i];
    switch (o.type) {
      case 'text':
        const textData = <TextOverlay>o.data;
        context2d.textAlign = 'center';
        context2d.textBaseline = 'middle';
        context2d.font = textData.font;
        context2d.fillStyle = textData.fillStyle;
        context2d.setTransform(textData.scale, 0, 0, textData.scale, 0, 0);
        context2d.fillText(
          textData.text,
          textData.x / textData.scale,
          textData.y / textData.scale,
        );
        break;
      case 'interactUI':
        const interactUIData = <InteractUIOverlay>o.data;
        context2d.setTransform(
          interactUIData.scale,
          0,
          0,
          interactUIData.scale,
          0,
          0,
        );
        const { x: iconX, y: iconY, scale: iconScale } = interactUIData;
        let iconName = 'unselected';
        if (isMobile()) {
          iconName = interactUIData.interacting
            ? 'mobile_pressed2x'
            : 'mobile2x';
        } else if (interactUIData.selected) {
          iconName = interactUIData.interacting ? 'desktop_pressed' : 'desktop';
        }
        const icon = interactive[iconName];
        if (icon.loaded && icon.image) {
          const pixelRatio2D = window.devicePixelRatio || 1;
          let width: number;
          let height: number;
          if (iconName === 'unselected') {
            width = icon.image.width * pixelRatio2D;
            height = icon.image.height * pixelRatio2D;
          } else {
            width = INTERACTIVE_ICON_SIZE * pixelRatio2D;
            height = INTERACTIVE_ICON_SIZE * pixelRatio2D;
          }
          context2d.drawImage(
            icon.image as HTMLImageElement,
            0,
            0,
            icon.image.width,
            icon.image.height,
            iconX / iconScale - width / 2,
            iconY / iconScale - height / 2,
            width,
            height,
          );
          if (iconName === 'mobile2x' || iconName === 'desktop') {
            const animTime =
              state.overlays.interactAnimation.phase * INTERACT_ANIM_TIME;
            const radius = height / 2;
            if (animTime <= 1000) {
              drawRoundedRegularPolygon(
                context2d,
                iconX / iconScale,
                iconY / iconScale,
                radius,
                animTime / 1000,
              );
            }
            if (animTime >= 700 && animTime <= 1700) {
              drawRoundedRegularPolygon(
                context2d,
                iconX / iconScale,
                iconY / iconScale,
                radius,
                (animTime - 700) / 1000,
              );
            }
            if (animTime >= 1400 && animTime <= 2400) {
              drawRoundedRegularPolygon(
                context2d,
                iconX / iconScale,
                iconY / iconScale,
                radius,
                (animTime - 1400) / 1000,
              );
            }
          }
        }
        break;
      case 'styleNumber':
        const styleNumberData = <StyleNumberOverlay>o.data;
        context2d.setTransform(
          styleNumberData.scale,
          0,
          0,
          styleNumberData.scale,
          0,
          0,
        );
        const text = styleNumberData.text;
        let posX = styleNumberData.x;
        for (let j = 0; j < text.length; j++) {
          const num = (text[j] as any) - ('0' as any);
          if (num >= 0 && num <= 9) {
            if (style_number[num].loaded && style_number[num].image != null) {
              context2d.drawImage(
                style_number[num].image as HTMLImageElement,
                0,
                0,
                style_number_width[num],
                style_number_height,
                posX / styleNumberData.scale,
                styleNumberData.y / styleNumberData.scale,
                style_number_width[num],
                style_number_height,
              );
            }
            posX += (style_number_width[num] + 5) * styleNumberData.scale;
          }
        }
        break;
      case 'bloodStrip':
        const bloodStripData = <BloodStripOverlay>o.data;
        context2d.setTransform(
          bloodStripData.scale,
          0,
          0,
          bloodStripData.scale,
          0,
          0,
        );
        context2d.fillStyle = bloodStripData.fillStyle;
        context2d.fillRect(
          bloodStripData.x / bloodStripData.scale - bloodStripData.barLen / 2,
          bloodStripData.y / bloodStripData.scale - bloodStripData.barWidth / 2,
          bloodStripData.barLen * bloodStripData.percentage,
          bloodStripData.barWidth,
        );
        if (bloodStripData.percentage !== 0) {
          context2d.beginPath();
          context2d.arc(
            bloodStripData.x / bloodStripData.scale - bloodStripData.barLen / 2,
            bloodStripData.y / bloodStripData.scale,
            bloodStripData.barWidth / 2,
            PI_2,
            -PI_2,
          );
          context2d.closePath();
          context2d.fill();
          context2d.beginPath();
          context2d.arc(
            bloodStripData.x / bloodStripData.scale +
              bloodStripData.barLen * (bloodStripData.percentage - 0.5),
            bloodStripData.y / bloodStripData.scale,
            bloodStripData.barWidth / 2,
            -PI_2,
            PI_2,
          );
          context2d.closePath();
          context2d.fill();
        }
        break;
      case 'playerIndicator':
        const playerIndicatorData = <PlayerIndicatorOverlay>o.data;
        const { x, y, scale } = playerIndicatorData;
        context2d.setTransform(scale, 0, 0, scale, 0, 0);
        // draw player indicator with image
        // TODO: change arrow style
        const indicator = indicators['arrow'];
        if (indicator.loaded && indicator.image) {
          const width = indicator.image.width / 12; // 原图缩放倍数
          const height = indicator.image.height / 12;
          context2d.drawImage(
            indicator.image,
            0,
            0,
            indicator.image.width,
            indicator.image.height,
            x / scale - width / 2,
            y / scale - height + 5, // 字体高度的一半
            width,
            height,
          );
        }
        break;
    }
  }

  // Clear list
  OverlayListSchema.free(overlays);
  state.overlays.overlays = OverlayListSchema.clone(OverlayListSchema.identity);
}

const worldPos = vec4.create();
const clipPos = vec4.create();

export function drawText3D(
  state: GameClientState,
  text: string,
  position: vec3 | number[] | [number, number, number],
  options?: {
    /**
     * 根据距离摄像机的远近决定scaleSize
     * 称为“摄像机距离产生的缩放比例”
     * 是视窗高度缩放倍率 的 系数
     */
    cameraDistanceScale?: number;
    font?: string;
    color?: vec4 | vec3 | number[] | string;
    perspective?: boolean;
    /**
     * 纯2D的Y轴偏移量 不受setTransform影响
     */
    offsetY?: number;
    /**
     * 视窗高度缩放倍率
     * 默认值：以1024为标准计算高度缩放倍率
     */
    windowHeightScale?: number;
  },
) {
  const context2D = state.overlays.context;
  if (!context2D) {
    return;
  }
  worldPos[0] = position[0];
  worldPos[1] = position[1];
  worldPos[2] = position[2];
  worldPos[3] = 1;
  vec4.transformMat4(clipPos, worldPos, state.camera.viewProjection);
  if (
    -clipPos[3] < clipPos[0] &&
    clipPos[0] < clipPos[3] &&
    -clipPos[3] < clipPos[1] &&
    clipPos[1] < clipPos[3] &&
    -clipPos[3] < clipPos[2] &&
    clipPos[2] < clipPos[3]
  ) {
    const textOverlay = TextOverlaySchema.alloc();
    const { width, height } = context2D.canvas;
    // 经过视图投影和剪裁，点的坐标会在裁剪空间（Clip Space）中表示，要将裁剪空间中的坐标转换为屏幕上的像素坐标，需要进行视口变换。
    // 将点从裁剪空间转换为屏幕上的具体像素位置，方便在2D屏幕上显示。
    textOverlay.x = 0.5 * width * (1 + clipPos[0] / clipPos[3]);
    textOverlay.y = 0.5 * height * (1 - clipPos[1] / clipPos[3]);
    textOverlay.scale = height / 1024;
    textOverlay.text = text;
    if (options) {
      textOverlay.font = options.font || '12pt Sans-Serif';
      if (typeof options.color === 'string') {
        textOverlay.fillStyle = options.color;
      } else if (options.color) {
        if (options.color.length === 3) {
          textOverlay.fillStyle = `rgb(${Math.round(
            options.color[0] * 255,
          )}, ${Math.round(options.color[1] * 255)}, ${Math.round(
            options.color[2] * 255,
          )})`;
        } else if (options.color.length === 4) {
          textOverlay.fillStyle = `rgba(${Math.round(
            options.color[0] * 255,
          )}, ${Math.round(options.color[1] * 255)}, ${Math.round(
            options.color[2] * 255,
          )}, ${options.color[3]})`;
        }
      } else {
        textOverlay.fillStyle = '#000';
      }
      if (options.windowHeightScale !== undefined) {
        textOverlay.scale = options.windowHeightScale;
      }
      if (typeof options.cameraDistanceScale === 'number') {
        textOverlay.scale *= options.cameraDistanceScale;
      }
      if (options.perspective) {
        textOverlay.scale /= clipPos[3];
      }
      if (options.offsetY !== undefined) {
        textOverlay.y -= options.offsetY;
      }
    } else {
      textOverlay.font = '12pt Sans-Serif';
      textOverlay.fillStyle = '#000';
    }
    const entry = OverlaySchema.alloc();
    entry.type = 'text';
    entry.data = textOverlay;
    state.overlays.overlays.push(entry);
  }
}

export function draw3DBloodStrip(
  state: GameClientState,
  bloodStrip: { percentage: number; barLen: number; barWidth: number },
  position: vec3 | number[] | [number, number, number],
  options?: {
    zIndex?: number;
    color?: vec4 | vec3 | number[] | string;
    /**
     * 纯2D的Y轴偏移量 不受setTransform影响
     */
    offsetY?: number;
    /**
     * 视窗高度缩放倍率
     * 默认值：以1024为标准计算高度缩放倍率
     */
    windowHeightScale?: number;
    /**
     * 根据距离摄像机的远近决定scaleSize
     * 称为“摄像机距离产生的缩放比例”
     * 是视窗高度缩放倍率 的 系数
     */
    cameraDistanceScale?: number;
  },
) {
  const context2D = state.overlays.context;
  if (!context2D) {
    return;
  }
  worldPos[0] = position[0];
  worldPos[1] = position[1];
  worldPos[2] = position[2];
  worldPos[3] = 1;

  vec4.transformMat4(clipPos, worldPos, state.camera.viewProjection);
  if (
    -clipPos[3] < clipPos[0] &&
    clipPos[0] < clipPos[3] &&
    -clipPos[3] < clipPos[1] &&
    clipPos[1] < clipPos[3] &&
    -clipPos[3] < clipPos[2] &&
    clipPos[2] < clipPos[3]
  ) {
    const bloodStripOverlay = BloodStripOverlaySchema.alloc();
    bloodStripOverlay.x =
      0.5 * context2D.canvas.width * (1 + clipPos[0] / clipPos[3]);
    bloodStripOverlay.y =
      0.5 * context2D.canvas.height * (1 - clipPos[1] / clipPos[3]);
    bloodStripOverlay.scale = context2D.canvas.height / 1024;
    bloodStripOverlay.percentage = bloodStrip.percentage;
    bloodStripOverlay.barLen = bloodStrip.barLen;
    bloodStripOverlay.barWidth = bloodStrip.barWidth;
    if (options) {
      if (typeof options.zIndex === 'number') {
        bloodStripOverlay.zIndex = options.zIndex;
      }
      if (typeof options.color === 'string') {
        bloodStripOverlay.fillStyle = options.color;
      } else if (options.color) {
        if (options.color.length === 3) {
          bloodStripOverlay.fillStyle = `rgb(${Math.round(
            options.color[0] * 255,
          )}, ${Math.round(options.color[1] * 255)}, ${Math.round(
            options.color[2] * 255,
          )})`;
        } else if (options.color.length === 4) {
          bloodStripOverlay.fillStyle = `rgba(${Math.round(
            options.color[0] * 255,
          )}, ${Math.round(options.color[1] * 255)}, ${Math.round(
            options.color[2] * 255,
          )}, ${options.color[3]})`;
        }
      } else {
        bloodStripOverlay.fillStyle = '#000';
      }
      if (options.windowHeightScale) {
        bloodStripOverlay.scale = options.windowHeightScale;
      }
      if (typeof options.cameraDistanceScale === 'number') {
        bloodStripOverlay.scale *= options.cameraDistanceScale;
      }
      if (options.offsetY !== undefined) {
        bloodStripOverlay.y -= options.offsetY;
      }
    }

    const entry = OverlaySchema.alloc();
    entry.type = 'bloodStrip';
    entry.data = bloodStripOverlay;
    state.overlays.overlays.push(entry);
  }
}

let indicatorDeltaY = 0;
let indicatorX = 1;
export function drawPlayerIndicator(
  state: GameClientState,
  position: vec3 | number[] | [number, number, number],
  options: {
    size?: number;
    perspective?: boolean;
  },
) {
  const context2D = state.overlays.context;
  if (!context2D) {
    return;
  }
  indicatorX += (2 * Math.PI) / (60 * 1.3);
  indicatorDeltaY += Math.sin(indicatorX) * 0.35;
  worldPos[0] = position[0];
  worldPos[1] = position[1];
  worldPos[2] = position[2];
  worldPos[3] = 1;
  vec4.transformMat4(clipPos, worldPos, state.camera.viewProjection);
  if (
    -clipPos[3] < clipPos[0] &&
    clipPos[0] < clipPos[3] &&
    -clipPos[3] < clipPos[1] &&
    clipPos[1] < clipPos[3] &&
    -clipPos[3] < clipPos[2] &&
    clipPos[2] < clipPos[3]
  ) {
    const { width, height } = context2D.canvas;
    const markerOverlay = PlayerIndicatorSchema.alloc();
    markerOverlay.x = 0.5 * width * (1 + clipPos[0] / clipPos[3]);
    markerOverlay.y =
      0.5 * height * (1 - clipPos[1] / clipPos[3]) - indicatorDeltaY;
    markerOverlay.scale = height / 1024;
    markerOverlay.zIndex = 10;

    if (typeof options.size === 'number') {
      markerOverlay.scale *= options.size;
    }
    if (options.perspective) {
      markerOverlay.scale /= clipPos[3];
    }

    const entry = OverlaySchema.alloc();
    entry.type = 'playerIndicator';
    entry.data = markerOverlay;
    state.overlays.overlays.push(entry);
  }
}

/**
 * 已知等边多边形外接圆的圆心坐标、半径，计算多边形各个顶点的坐标
 * @param cx 圆心x坐标
 * @param cy 圆心y坐标
 * @param r 圆的半径
 * @param sides 多边形的边数
 * @param startRadian 多边形第一个顶点与x轴的夹角
 */
function getRegularPolygonPoints(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  startRadian: number,
) {
  const points: vec2[] = [];
  const perRadian = (2 * Math.PI) / sides;
  for (let i = 0; i < sides; i++) {
    let radian = i * perRadian + startRadian;
    if (radian > 2 * Math.PI) {
      radian -= 2 * Math.PI;
    }
    points.push(
      vec2.fromValues(cx + r * Math.cos(radian), cy + r * Math.sin(radian)),
    );
  }
  return points;
}

function drawRoundedRegularPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  animPhase: number,
) {
  const radius = r + r * animPhase;
  const points = getRegularPolygonPoints(cx, cy, radius, 6, Math.PI / 6);

  const edgeLength = vec2.distance(points[0], points[1]);
  const corners: vec2[][] = [];

  for (let i = 0; i < points.length; i++) {
    // 每段圆弧由相邻三个顶点的位置来确定，thisPoint为圆弧所在位置的顶点
    const lastPoint = points[i % points.length];
    const thisPoint = points[(i + 1) % points.length];
    const nextPoint = points[(i + 2) % points.length];

    // 计算圆弧的起始点和结束点
    const start = vec2.lerp(
      vec2.create(),
      thisPoint,
      lastPoint,
      2 / edgeLength,
    );
    const end = vec2.lerp(vec2.create(), thisPoint, nextPoint, 2 / edgeLength);

    corners.push([start, thisPoint, end]);
  }

  const alpha = 1 - animPhase;
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = Math.max(window.devicePixelRatio || 1);

  ctx.beginPath();
  ctx.moveTo(corners[0][0][0], corners[0][0][1]);
  for (const [start, ctrl, end] of corners) {
    ctx.lineTo(start[0], start[1]);
    ctx.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]);
  }
  ctx.closePath();
  ctx.stroke();
}

/**
 * 以768为标准计算高度缩放倍率
 * 缩放倍率在0.75到1之间
 */
export function getHeightScale(context2D: CanvasRenderingContext2D) {
  return Math.max(
    0.75 * window.devicePixelRatio,
    Math.min(context2D.canvas.height / 768, 1 * window.devicePixelRatio),
  );
}
/**
 * 更新射线检测结果到renderBox：
 * - 摄像机到body中心点的射线未被「非水形的地形」遮挡 且 距离在可视范围内时可见，并计算摄像机距离产生的缩放。
 * - 不可见时缩放率为0。
 */
export function updateVisibilityAndScale(
  state: GameClientState,
  box: RenderBox,
) {
  if (box.overlayInfoVisibleScale !== undefined) {
    return;
  }
  const result = raycastEye(
    state,
    [box.anchorX, box.anchorY, box.anchorZ],
    true,
    CUTOFF_FAR,
  );
  box.overlayInfoVisibleScale = result
    ? result.isNear
      ? OverlayInfoVisibleScaleEnum.NearScale
      : OverlayInfoVisibleScaleEnum.FarScale
    : OverlayInfoVisibleScaleEnum.Invisible;
}
