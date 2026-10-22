import { sort } from 'ramda';
import type { TreeNode as ProjectTreeNode } from '@box/schema/project/project-rda';
import {
  ROOT_ID,
  TreeNodeType as MuRDATreeNodeType,
  MuRDATree,
  TreeStructTypes,
} from '@box/schema/project/murda-tree';
import { MuRDA } from '@box/mudb/rda';

/**
 * 基于MuRDATree的TreeNode的抽象，不需要value的部分
 */
type RDATreeNode = Omit<ProjectTreeNode, 'value'>;

type RDATree = Record<string, RDATreeNode>;

/**
 * 以某个节点为入口，存入所有子节点的id数组
 * @param out id数组
 * @param tree 入口节点
 */
export function parseTree<ValueRDA extends MuRDA<any, any, any, any>>(
  out: string[],
  sourceData: TreeStructTypes<ValueRDA>['treeNodes']['identity'],
  node: TreeStructTypes<ValueRDA>['node']['identity'],
) {
  if (!node.childrenIds || !node.childrenIds.length) {
    return;
  }

  node.childrenIds.forEach((childId) => {
    const child = sourceData[childId];
    if (child?.type !== MuRDATreeNodeType.leaf) {
      parseTree(out, sourceData, child);
      return;
    }
    out.push(node.id);
  });
}

export function getBreadcrumbs(rdaTree: RDATree, nodeId: string) {
  const breadcrumbs: string[] = [];
  let parentId = rdaTree[nodeId]?.parentId;

  while (parentId && parentId !== ROOT_ID) {
    breadcrumbs.push(parentId);
    parentId = getParentId(rdaTree, parentId);
  }

  return breadcrumbs;
}

function getParentId(rdaTree: RDATree, nodeId: string) {
  return rdaTree[nodeId]?.parentId;
}

export function isChildren(rdaTree: RDATree, nodeA: string, nodeB: string) {
  const nodeNode = rdaTree[nodeA];
  if (!nodeNode || nodeNode.type === MuRDATreeNodeType.leaf) {
    return;
  }
  let parentId = getParentId(rdaTree, nodeB);
  while (parentId && parentId !== ROOT_ID) {
    if (parentId === nodeNode.id) {
      return true;
    }
    parentId = getParentId(rdaTree, parentId);
  }
  return false;
}

function getParentChildren(rdaTree: RDATree, node: string) {
  const parentId = getParentId(rdaTree, node);
  if (!parentId) {
    return;
  }

  return rdaTree[parentId]?.childrenIds;
}

function findIndex(rdaTree: RDATree, nodeId: string) {
  const targetTreeNodes = getParentChildren(rdaTree, nodeId);

  return targetTreeNodes ? targetTreeNodes.indexOf(nodeId) : -1;
}

export function sortTreeNodes(rdaTree: RDATree, nodeIds: string[]) {
  return sort((a, b) => {
    const breadcrumbsA = getBreadcrumbs(rdaTree, a);
    const breadcrumbsB = getBreadcrumbs(rdaTree, b);
    let treeNodeIdA = breadcrumbsA.pop();
    let treeNodeIdB = breadcrumbsB.pop();
    while (
      treeNodeIdA === treeNodeIdB &&
      treeNodeIdA !== undefined &&
      treeNodeIdB !== undefined
    ) {
      treeNodeIdA = breadcrumbsA.pop();
      treeNodeIdB = breadcrumbsB.pop();
    }
    const aIndex = findIndex(rdaTree, treeNodeIdA || a);
    const bIndex = findIndex(rdaTree, treeNodeIdB || b);
    return aIndex - bIndex;
  }, nodeIds);
}

export function isValidName(text: string) {
  // 不允许输入连续空格
  if (text.match(/\s{2,}/g)) {
    return false;
  }

  // 命名中允许使用的字符：中文、大小写英文、数字、空格和部分符号
  return /^[\p{Unified_Ideograph}\w_ ()'（）-]+$/u.test(text);
}

export function getTopSelectedId<ValueRDA extends MuRDA<any, any, any, any>>(
  sourceData: TreeStructTypes<ValueRDA>['treeNodes']['identity'],
  selectedIds: string[],
) {
  if (!selectedIds.length) {
    return;
  }
  if (selectedIds.length === 1) {
    return selectedIds[0];
  }

  const list = sourceData[ROOT_ID].childrenIds.slice();
  while (list.length) {
    const currId = list.shift();
    if (!currId) {
      return;
    }
    if (selectedIds.includes(currId)) {
      return currId;
    }
    const children = sourceData[currId]?.childrenIds;
    if (!children || !children.length) {
      continue;
    }

    for (let i = children.length - 1; i >= 0; i--) {
      const childId = children[i];

      list.unshift(childId);
    }
  }

  return;
}

export function parseSearchedData<ValueRDA extends MuRDA<any, any, any, any>>(
  out: TreeStructTypes<ValueRDA>['treeNodes']['identity'],
  RDA: MuRDATree<ValueRDA>,
  sourceData: TreeStructTypes<ValueRDA>['treeNodes']['identity'],
  searchKey: string,
) {
  out[ROOT_ID] = RDA.nodeSchema.alloc();
  RDA.nodeSchema.assign(out[ROOT_ID], sourceData[ROOT_ID]);
  out[ROOT_ID].childrenIds = [];
  Object.keys(sourceData).forEach((nodeId) => {
    const node = sourceData[nodeId];
    if (node.name.toLowerCase().indexOf(searchKey.toLocaleLowerCase()) < 0) {
      return;
    }
    out[nodeId] = RDA.nodeSchema.alloc();
    RDA.nodeSchema.assign(out[nodeId], node);

    // 处理children
    // 被搜索到的节点如果含有子节点，所有的子节点都要展示
    const list = out[nodeId].childrenIds.slice();
    while (list.length) {
      const child = list.shift();
      if (!child) {
        break;
      }
      const childNode = sourceData[child];

      out[child] = RDA.nodeSchema.alloc();
      RDA.nodeSchema.assign(out[child], childNode);
      list.unshift(...childNode.childrenIds);
    }

    // 处理父级
    // 被搜索到的节点要展示他所有的父级，他的父级只需要展示被搜索到的元素即可
    let currId = node.id;
    let parentId = node.parentId;
    while (parentId) {
      // 如果父级已经确认需要展示，只添加childrenIds即可
      if (out[parentId]) {
        const newIds = sourceData[parentId].childrenIds.filter(
          (id) => out[parentId].childrenIds.includes(id) || id === currId,
        );
        out[parentId].childrenIds = newIds;
      } else {
        // 新增父级，childrenIds只留当前节点
        out[parentId] = RDA.nodeSchema.alloc();
        RDA.nodeSchema.assign(out[parentId], sourceData[parentId]);
        out[parentId].childrenIds = [currId];
      }

      currId = parentId;
      parentId = sourceData[parentId].parentId;
    }
  });

  return out;
}

/**
 * 查找在选中节点中，在列表层级最高，且排序最前面的节点
 * @param sourceData
 * @param selectedIds
 */
export function searchFirstNode<ValueRDA extends MuRDA<any, any, any, any>>(
  sourceData: TreeStructTypes<ValueRDA>['treeNodes']['identity'],
  selectedIds: string[],
) {
  const list: string[] = sourceData[ROOT_ID].childrenIds.slice();

  while (list.length) {
    const id = list.shift();

    if (!id) {
      break;
    }

    if (selectedIds.includes(id)) {
      return id;
    }

    const node = sourceData[id];

    if (!node || !node.childrenIds.length) {
      continue;
    }

    list.push(...node.childrenIds);
  }

  return;
}
