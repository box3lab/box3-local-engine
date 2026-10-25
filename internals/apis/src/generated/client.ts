/**
 * Generated from openapi/openapi.json. Do not edit by hand.
 *
 * Every Local Engine HTTP operation is exposed as a named method so callers
 * never need to duplicate a route or HTTP verb.
 */
import createClient, {
  type Client,
  type ClientOptions,
  type FetchResponse,
  type PathBasedClient,
  wrapAsPathBasedClient,
} from 'openapi-fetch';

import type { paths } from './openapi';

export const apiOperations = {
  "deleteApiCreatorModelsId": {
    "path": "/api/creator-models/{id}",
    "method": "DELETE"
  },
  "deleteApiCreatorV1ProjectsProjectIdSceneSession": {
    "path": "/api/creator/v1/projects/{projectId}/scene/session",
    "method": "DELETE"
  },
  "deleteApiCreatorV1ProjectsProjectIdStorageScopeSpace": {
    "path": "/api/creator/v1/projects/{projectId}/storage/{scope}/{space}",
    "method": "DELETE"
  },
  "deleteApiLocalAiSession": {
    "path": "/api/local/ai/session",
    "method": "DELETE"
  },
  "deleteApiLocalAiSessionId": {
    "path": "/api/local/ai/session/{id}",
    "method": "DELETE"
  },
  "deleteApiLocalModelsId": {
    "path": "/api/local/models/{id}",
    "method": "DELETE"
  },
  "deleteApiLocalProjectsId": {
    "path": "/api/local-projects/{id}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminAdminsId": {
    "path": "/api/play-admin/admins/{id}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminContainerResourceGroupsId": {
    "path": "/api/play-admin/container-resource-groups/{id}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminContainersPermanentMapId": {
    "path": "/api/play-admin/containers/{permanentMapId}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminImport": {
    "path": "/api/play-admin/import",
    "method": "DELETE"
  },
  "deleteApiPlayAdminLibraryImport": {
    "path": "/api/play-admin/library/import",
    "method": "DELETE"
  },
  "deleteApiPlayAdminLibrarySection": {
    "path": "/api/play-admin/library/{section}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminLibrarySectionId": {
    "path": "/api/play-admin/library/{section}/{id}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminModelsId": {
    "path": "/api/play-admin/models/{id}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminPermissionGroupsId": {
    "path": "/api/play-admin/permission-groups/{id}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminPlayersSubjectId": {
    "path": "/api/play-admin/players/{subjectId}",
    "method": "DELETE"
  },
  "deleteApiPlayAdminWorldsId": {
    "path": "/api/play-admin/worlds/{id}",
    "method": "DELETE"
  },
  "deleteApiPlayPresence": {
    "path": "/api/play-presence",
    "method": "DELETE"
  },
  "deleteApiRuntimeContainerId": {
    "path": "/api/runtime/{container_id}",
    "method": "DELETE"
  },
  "getApiAuthSession": {
    "path": "/api/auth/session",
    "method": "GET"
  },
  "getApiBackupsArchiveDownload": {
    "path": "/api/backups/{archive}/download",
    "method": "GET"
  },
  "getApiConfigSlug": {
    "path": "/api/config/{slug}",
    "method": "GET"
  },
  "getApiCreatorModels": {
    "path": "/api/creator-models",
    "method": "GET"
  },
  "getApiCreatorModelsBlobsHash": {
    "path": "/api/creator-models/blobs/{hash}",
    "method": "GET"
  },
  "getApiCreatorModelsIdExport": {
    "path": "/api/creator-models/{id}/export",
    "method": "GET"
  },
  "getApiCreatorPermissions": {
    "path": "/api/creator-permissions",
    "method": "GET"
  },
  "getApiCreatorV1Health": {
    "path": "/api/creator/v1/health",
    "method": "GET"
  },
  "getApiCreatorV1Projects": {
    "path": "/api/creator/v1/projects",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdResources": {
    "path": "/api/creator/v1/projects/{projectId}/resources",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdRuntime": {
    "path": "/api/creator/v1/projects/{projectId}/runtime",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdRuntimeEvents": {
    "path": "/api/creator/v1/projects/{projectId}/runtime/events",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdSceneAction": {
    "path": "/api/creator/v1/projects/{projectId}/scene/action",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdSceneCapture": {
    "path": "/api/creator/v1/projects/{projectId}/scene/capture",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdSceneSession": {
    "path": "/api/creator/v1/projects/{projectId}/scene/session",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdScripts": {
    "path": "/api/creator/v1/projects/{projectId}/scripts",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdScriptsSideEntry": {
    "path": "/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}",
    "method": "GET"
  },
  "getApiCreatorV1ProjectsProjectIdStorageScopeSpace": {
    "path": "/api/creator/v1/projects/{projectId}/storage/{scope}/{space}",
    "method": "GET"
  },
  "getApiDiagnosticsArchiveDownload": {
    "path": "/api/diagnostics/{archive}/download",
    "method": "GET"
  },
  "getApiGetMapInfo": {
    "path": "/api/getMapInfo",
    "method": "GET"
  },
  "getApiHealth": {
    "path": "/api/health",
    "method": "GET"
  },
  "getApiHealthCheck": {
    "path": "/api/health-check",
    "method": "GET"
  },
  "getApiLocalAiSession": {
    "path": "/api/local/ai/session",
    "method": "GET"
  },
  "getApiLocalAiSessionIdCommands": {
    "path": "/api/local/ai/session/{id}/commands",
    "method": "GET"
  },
  "getApiLocalAiSessionIdCommandsRequestId": {
    "path": "/api/local/ai/session/{id}/commands/{requestId}",
    "method": "GET"
  },
  "getApiLocalBlobsHash": {
    "path": "/api/local/blobs/{hash}",
    "method": "GET"
  },
  "getApiLocalDefaultSkin": {
    "path": "/api/local/default-skin",
    "method": "GET"
  },
  "getApiLocalModels": {
    "path": "/api/local/models",
    "method": "GET"
  },
  "getApiLocalModelsAuthoring": {
    "path": "/api/local/models/authoring",
    "method": "GET"
  },
  "getApiLocalModelsId": {
    "path": "/api/local/models/{id}",
    "method": "GET"
  },
  "getApiLocalModelsIdExport": {
    "path": "/api/local/models/{id}/export",
    "method": "GET"
  },
  "getApiLocalModelsIdSnapshots": {
    "path": "/api/local/models/{id}/snapshots",
    "method": "GET"
  },
  "getApiLocalProjects": {
    "path": "/api/local-projects",
    "method": "GET"
  },
  "getApiLocalProjectsAssetDistribution": {
    "path": "/api/local-projects/asset-distribution",
    "method": "GET"
  },
  "getApiLocalProjectsIdExport": {
    "path": "/api/local-projects/{id}/export",
    "method": "GET"
  },
  "getApiLocalProjectsIdMaps": {
    "path": "/api/local-projects/{id}/maps",
    "method": "GET"
  },
  "getApiLocalProjectsIdRuntime": {
    "path": "/api/local-projects/{id}/runtime",
    "method": "GET"
  },
  "getApiLocalProjectsIdSnapshots": {
    "path": "/api/local-projects/{id}/snapshots",
    "method": "GET"
  },
  "getApiOperationsId": {
    "path": "/api/operations/{id}",
    "method": "GET"
  },
  "getApiPlayAdminActivity": {
    "path": "/api/play-admin/activity",
    "method": "GET"
  },
  "getApiPlayAdminAdmins": {
    "path": "/api/play-admin/admins",
    "method": "GET"
  },
  "getApiPlayAdminContainerResourceGroups": {
    "path": "/api/play-admin/container-resource-groups",
    "method": "GET"
  },
  "getApiPlayAdminContainers": {
    "path": "/api/play-admin/containers",
    "method": "GET"
  },
  "getApiPlayAdminIdentityBans": {
    "path": "/api/play-admin/identity-bans",
    "method": "GET"
  },
  "getApiPlayAdminImport": {
    "path": "/api/play-admin/import",
    "method": "GET"
  },
  "getApiPlayAdminImportResource": {
    "path": "/api/play-admin/import-resource",
    "method": "GET"
  },
  "getApiPlayAdminLibraryImport": {
    "path": "/api/play-admin/library/import",
    "method": "GET"
  },
  "getApiPlayAdminLibrarySection": {
    "path": "/api/play-admin/library/{section}",
    "method": "GET"
  },
  "getApiPlayAdminLibrarySectionId": {
    "path": "/api/play-admin/library/{section}/{id}",
    "method": "GET"
  },
  "getApiPlayAdminModels": {
    "path": "/api/play-admin/models",
    "method": "GET"
  },
  "getApiPlayAdminPermissionGroups": {
    "path": "/api/play-admin/permission-groups",
    "method": "GET"
  },
  "getApiPlayAdminPlayers": {
    "path": "/api/play-admin/players",
    "method": "GET"
  },
  "getApiPlayAdminPlayersExport": {
    "path": "/api/play-admin/players/export",
    "method": "GET"
  },
  "getApiPlayAdminPlayersOverview": {
    "path": "/api/play-admin/players/overview",
    "method": "GET"
  },
  "getApiPlayAdminPlayersSubjectId": {
    "path": "/api/play-admin/players/{subjectId}",
    "method": "GET"
  },
  "getApiPlayAdminScriptModeration": {
    "path": "/api/play-admin/script-moderation",
    "method": "GET"
  },
  "getApiPlayAdminStatus": {
    "path": "/api/play-admin/status",
    "method": "GET"
  },
  "getApiPlayAdminVerify": {
    "path": "/api/play-admin/verify",
    "method": "GET"
  },
  "getApiPlayAdminWorlds": {
    "path": "/api/play-admin/worlds",
    "method": "GET"
  },
  "getApiPlayAdminWorldsStatus": {
    "path": "/api/play-admin/worlds/status",
    "method": "GET"
  },
  "getApiPlayerAuthLoginRequired": {
    "path": "/api/player-auth/login-required",
    "method": "GET"
  },
  "getApiPlayerAuthSession": {
    "path": "/api/player-auth/session",
    "method": "GET"
  },
  "getApiPlayerInternalMapLibrary": {
    "path": "/api/player-internal/map-library",
    "method": "GET"
  },
  "getApiPlayerInternalRevocations": {
    "path": "/api/player-internal/revocations",
    "method": "GET"
  },
  "getApiPlayerLauncherBootstrap": {
    "path": "/api/player-launcher/bootstrap",
    "method": "GET"
  },
  "getApiPlayerLauncherMaps": {
    "path": "/api/player-launcher/maps",
    "method": "GET"
  },
  "getApiPlayerLauncherMapsMapIdDescriptor": {
    "path": "/api/player-launcher/maps/{mapId}/descriptor",
    "method": "GET"
  },
  "getApiPlayerLauncherMapsMapIdDownloadPlan": {
    "path": "/api/player-launcher/maps/{mapId}/download-plan",
    "method": "GET"
  },
  "getApiPlayerLoginCallback": {
    "path": "/api/player-login/callback",
    "method": "GET"
  },
  "getApiPlayerLoginStart": {
    "path": "/api/player-login/start",
    "method": "GET"
  },
  "getApiPlayLibrary": {
    "path": "/api/play-library",
    "method": "GET"
  },
  "getApiPlayModels": {
    "path": "/api/play-models",
    "method": "GET"
  },
  "getApiPlayModelsId": {
    "path": "/api/play-models/{id}",
    "method": "GET"
  },
  "getApiPlayPresence": {
    "path": "/api/play-presence",
    "method": "GET"
  },
  "getApiPlayResourceCacheWorld": {
    "path": "/api/play-resource-cache/{world}",
    "method": "GET"
  },
  "getApiPlayWorlds": {
    "path": "/api/play-worlds",
    "method": "GET"
  },
  "getApiProjectModels": {
    "path": "/api/project-models",
    "method": "GET"
  },
  "getApiProjectSkinPreviews": {
    "path": "/api/project-skin-previews",
    "method": "GET"
  },
  "getApiProjectSkins": {
    "path": "/api/project-skins",
    "method": "GET"
  },
  "getApiRuntimeContainerIdStats": {
    "path": "/api/runtime/{container_id}/stats",
    "method": "GET"
  },
  "getApiServerInfo": {
    "path": "/api/server-info",
    "method": "GET"
  },
  "getApiSession": {
    "path": "/api/session",
    "method": "GET"
  },
  "getApiSystemBackups": {
    "path": "/api/system/backups",
    "method": "GET"
  },
  "getApiSystemBackupsProjectIdName": {
    "path": "/api/system/backups/{projectId}/{name}",
    "method": "GET"
  },
  "getApiSystemStatus": {
    "path": "/api/system/status",
    "method": "GET"
  },
  "getBlockHash": {
    "path": "/block/{hash}",
    "method": "GET"
  },
  "getInternalCreatorPreviewRuntime": {
    "path": "/internal/creator-preview-runtime",
    "method": "GET"
  },
  "getInternalCreatorPreviewRuntimeEvents": {
    "path": "/internal/creator-preview-runtime/events",
    "method": "GET"
  },
  "getLocalRuntimeStatus": {
    "path": "/__local_runtime/status",
    "method": "GET"
  },
  "patchApiAuthProfile": {
    "path": "/api/auth/profile",
    "method": "PATCH"
  },
  "patchApiCreatorProfile": {
    "path": "/api/creator-profile",
    "method": "PATCH"
  },
  "patchApiLocalProjectsAssetDistribution": {
    "path": "/api/local-projects/asset-distribution",
    "method": "PATCH"
  },
  "patchApiLocalProjectsId": {
    "path": "/api/local-projects/{id}",
    "method": "PATCH"
  },
  "patchApiPlayAdminAdminsId": {
    "path": "/api/play-admin/admins/{id}",
    "method": "PATCH"
  },
  "patchApiPlayAdminContainerResourceGroupsId": {
    "path": "/api/play-admin/container-resource-groups/{id}",
    "method": "PATCH"
  },
  "patchApiPlayAdminLibrarySection": {
    "path": "/api/play-admin/library/{section}",
    "method": "PATCH"
  },
  "patchApiPlayAdminLibrarySectionId": {
    "path": "/api/play-admin/library/{section}/{id}",
    "method": "PATCH"
  },
  "patchApiPlayAdminModelsId": {
    "path": "/api/play-admin/models/{id}",
    "method": "PATCH"
  },
  "patchApiPlayAdminPermissionGroupsId": {
    "path": "/api/play-admin/permission-groups/{id}",
    "method": "PATCH"
  },
  "patchApiPlayAdminPlayersSubjectId": {
    "path": "/api/play-admin/players/{subjectId}",
    "method": "PATCH"
  },
  "patchApiPlayAdminWorldsId": {
    "path": "/api/play-admin/worlds/{id}",
    "method": "PATCH"
  },
  "patchApiPlayerAuthProfile": {
    "path": "/api/player-auth/profile",
    "method": "PATCH"
  },
  "patchApiPlayerInternalMapLibrary": {
    "path": "/api/player-internal/map-library",
    "method": "PATCH"
  },
  "patchApiPlayerInternalProfile": {
    "path": "/api/player-internal/profile",
    "method": "PATCH"
  },
  "patchApiPlayLibrary": {
    "path": "/api/play-library",
    "method": "PATCH"
  },
  "patchApiPlayProfile": {
    "path": "/api/play-profile",
    "method": "PATCH"
  },
  "postApiAuthLogin": {
    "path": "/api/auth/login",
    "method": "POST"
  },
  "postApiAuthLogout": {
    "path": "/api/auth/logout",
    "method": "POST"
  },
  "postApiAuthPassword": {
    "path": "/api/auth/password",
    "method": "POST"
  },
  "postApiAuthRegister": {
    "path": "/api/auth/register",
    "method": "POST"
  },
  "postApiBackupsUpload": {
    "path": "/api/backups/upload",
    "method": "POST"
  },
  "postApiCommandsName": {
    "path": "/api/commands/{name}",
    "method": "POST"
  },
  "postApiCreateSession": {
    "path": "/api/createSession",
    "method": "POST"
  },
  "postApiCreatorLogout": {
    "path": "/api/creator-logout",
    "method": "POST"
  },
  "postApiCreatorModelsImport": {
    "path": "/api/creator-models/import",
    "method": "POST"
  },
  "postApiCreatorV1ProjectsProjectIdRuntime": {
    "path": "/api/creator/v1/projects/{projectId}/runtime",
    "method": "POST"
  },
  "postApiCreatorV1ProjectsProjectIdSceneActionsRequestId": {
    "path": "/api/creator/v1/projects/{projectId}/scene/actions/{requestId}",
    "method": "POST"
  },
  "postApiCreatorV1ProjectsProjectIdSceneSession": {
    "path": "/api/creator/v1/projects/{projectId}/scene/session",
    "method": "POST"
  },
  "postApiLocalAiSession": {
    "path": "/api/local/ai/session",
    "method": "POST"
  },
  "postApiLocalAiSessionIdCommands": {
    "path": "/api/local/ai/session/{id}/commands",
    "method": "POST"
  },
  "postApiLocalAiSessionIdCommandsRequestId": {
    "path": "/api/local/ai/session/{id}/commands/{requestId}",
    "method": "POST"
  },
  "postApiLocalAiSocket": {
    "path": "/api/local/ai/socket",
    "method": "POST"
  },
  "postApiLocalAnimationPreview": {
    "path": "/api/local/animation-preview",
    "method": "POST"
  },
  "postApiLocalBlob": {
    "path": "/api/local/blob",
    "method": "POST"
  },
  "postApiLocalModels": {
    "path": "/api/local/models",
    "method": "POST"
  },
  "postApiLocalModelsAuthoring": {
    "path": "/api/local/models/authoring",
    "method": "POST"
  },
  "postApiLocalModelsImport": {
    "path": "/api/local/models/import",
    "method": "POST"
  },
  "postApiLocalModelsRenderSheet": {
    "path": "/api/local/models/render-sheet",
    "method": "POST"
  },
  "postApiLocalProjects": {
    "path": "/api/local-projects",
    "method": "POST"
  },
  "postApiLocalProjectsIdExpand": {
    "path": "/api/local-projects/{id}/expand",
    "method": "POST"
  },
  "postApiLocalProjectsIdMaps": {
    "path": "/api/local-projects/{id}/maps",
    "method": "POST"
  },
  "postApiLocalProjectsIdPackage": {
    "path": "/api/local-projects/{id}/package",
    "method": "POST"
  },
  "postApiLocalProjectsIdPublish": {
    "path": "/api/local-projects/{id}/publish",
    "method": "POST"
  },
  "postApiLocalProjectsIdRuntime": {
    "path": "/api/local-projects/{id}/runtime",
    "method": "POST"
  },
  "postApiLocalProjectsIdSnapshots": {
    "path": "/api/local-projects/{id}/snapshots",
    "method": "POST"
  },
  "postApiLocalProjectsImport": {
    "path": "/api/local-projects/import",
    "method": "POST"
  },
  "postApiPlayAdminAdmins": {
    "path": "/api/play-admin/admins",
    "method": "POST"
  },
  "postApiPlayAdminContainerResourceGroups": {
    "path": "/api/play-admin/container-resource-groups",
    "method": "POST"
  },
  "postApiPlayAdminContainers": {
    "path": "/api/play-admin/containers",
    "method": "POST"
  },
  "postApiPlayAdminIdentityBans": {
    "path": "/api/play-admin/identity-bans",
    "method": "POST"
  },
  "postApiPlayAdminImport": {
    "path": "/api/play-admin/import",
    "method": "POST"
  },
  "postApiPlayAdminLibraryImport": {
    "path": "/api/play-admin/library/import",
    "method": "POST"
  },
  "postApiPlayAdminLibrarySection": {
    "path": "/api/play-admin/library/{section}",
    "method": "POST"
  },
  "postApiPlayAdminLibrarySectionId": {
    "path": "/api/play-admin/library/{section}/{id}",
    "method": "POST"
  },
  "postApiPlayAdminLogin": {
    "path": "/api/play-admin/login",
    "method": "POST"
  },
  "postApiPlayAdminLogout": {
    "path": "/api/play-admin/logout",
    "method": "POST"
  },
  "postApiPlayAdminMaintenance": {
    "path": "/api/play-admin/maintenance",
    "method": "POST"
  },
  "postApiPlayAdminModels": {
    "path": "/api/play-admin/models",
    "method": "POST"
  },
  "postApiPlayAdminOwnerSession": {
    "path": "/api/play-admin/owner-session",
    "method": "POST"
  },
  "postApiPlayAdminPermissionGroups": {
    "path": "/api/play-admin/permission-groups",
    "method": "POST"
  },
  "postApiPlayAdminPlayers": {
    "path": "/api/play-admin/players",
    "method": "POST"
  },
  "postApiPlayAdminPlayersBatch": {
    "path": "/api/play-admin/players/batch",
    "method": "POST"
  },
  "postApiPlayAdminPlayersSubjectId": {
    "path": "/api/play-admin/players/{subjectId}",
    "method": "POST"
  },
  "postApiPlayAdminScriptModeration": {
    "path": "/api/play-admin/script-moderation",
    "method": "POST"
  },
  "postApiPlayAdminSelfPassword": {
    "path": "/api/play-admin/self-password",
    "method": "POST"
  },
  "postApiPlayAdminVerify": {
    "path": "/api/play-admin/verify",
    "method": "POST"
  },
  "postApiPlayerAuthLogin": {
    "path": "/api/player-auth/login",
    "method": "POST"
  },
  "postApiPlayerAuthLogout": {
    "path": "/api/player-auth/logout",
    "method": "POST"
  },
  "postApiPlayerAuthPassword": {
    "path": "/api/player-auth/password",
    "method": "POST"
  },
  "postApiPlayerAuthRegister": {
    "path": "/api/player-auth/register",
    "method": "POST"
  },
  "postApiPlayerAuthTransfer": {
    "path": "/api/player-auth/transfer",
    "method": "POST"
  },
  "postApiPlayerInternalLoginTransfer": {
    "path": "/api/player-internal/login-transfer",
    "method": "POST"
  },
  "postApiPlayerInternalLogout": {
    "path": "/api/player-internal/logout",
    "method": "POST"
  },
  "postApiPlayerInternalMapAdmission": {
    "path": "/api/player-internal/map-admission",
    "method": "POST"
  },
  "postApiPlayerInternalRuntimeIdentity": {
    "path": "/api/player-internal/runtime-identity",
    "method": "POST"
  },
  "postApiPlayerInternalScriptMetadata": {
    "path": "/api/player-internal/script-metadata",
    "method": "POST"
  },
  "postApiPlayerInternalScriptModeration": {
    "path": "/api/player-internal/script-moderation",
    "method": "POST"
  },
  "postApiPlayLogout": {
    "path": "/api/play-logout",
    "method": "POST"
  },
  "postApiPlayPresence": {
    "path": "/api/play-presence",
    "method": "POST"
  },
  "postApiProjectModels": {
    "path": "/api/project-models",
    "method": "POST"
  },
  "postApiProjectScripts": {
    "path": "/api/project-scripts",
    "method": "POST"
  },
  "postApiProjectSkins": {
    "path": "/api/project-skins",
    "method": "POST"
  },
  "postApiRealtimeSession": {
    "path": "/api/realtime/session",
    "method": "POST"
  },
  "postApiRuntimeEnsure": {
    "path": "/api/runtime/ensure",
    "method": "POST"
  },
  "postApiSystemBackups": {
    "path": "/api/system/backups",
    "method": "POST"
  },
  "postBlock": {
    "path": "/block",
    "method": "POST"
  },
  "postBlockHash": {
    "path": "/block/{hash}",
    "method": "POST"
  },
  "postCreateSession": {
    "path": "/createSession",
    "method": "POST"
  },
  "postInternalSaveLocalProject": {
    "path": "/internal/save-local-project",
    "method": "POST"
  },
  "postLocalRuntimeDestroy": {
    "path": "/__local_runtime/destroy",
    "method": "POST"
  },
  "postLocalRuntimeStart": {
    "path": "/__local_runtime/start",
    "method": "POST"
  },
  "postRoomRoomIdLocalRuntimeDestroy": {
    "path": "/__room/{roomId}/__local_runtime/destroy",
    "method": "POST"
  },
  "putApiCreatorModelsId": {
    "path": "/api/creator-models/{id}",
    "method": "PUT"
  },
  "putApiCreatorV1ProjectsProjectIdScriptsSideEntry": {
    "path": "/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}",
    "method": "PUT"
  },
  "putApiCreatorV1ProjectsProjectIdStorageScopeSpace": {
    "path": "/api/creator/v1/projects/{projectId}/storage/{scope}/{space}",
    "method": "PUT"
  },
  "putApiLocalDefaultSkin": {
    "path": "/api/local/default-skin",
    "method": "PUT"
  },
  "putApiLocalModelsId": {
    "path": "/api/local/models/{id}",
    "method": "PUT"
  }
} as const;

export interface ApiClientOptions extends ClientOptions {
  csrfCookie?: string;
  csrfHeader?: string;
  defaultErrorMessage?: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly response: Response,
    readonly details: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  readonly raw: Client<paths>;
  private readonly paths: PathBasedClient<paths>;
  private readonly defaultErrorMessage: string;

  constructor(options: ApiClientOptions = {}) {
    const {
      csrfCookie,
      csrfHeader = 'X-CSRF-Token',
      defaultErrorMessage = '请求失败，请稍后重试',
      ...clientOptions
    } = options;
    this.defaultErrorMessage = defaultErrorMessage;
    this.raw = createClient<paths>({ credentials: 'same-origin', ...clientOptions });
    if (csrfCookie) {
      this.raw.use({
        onRequest({ request }) {
          if (typeof document === 'undefined' || /^(GET|HEAD|OPTIONS)$/i.test(request.method)) {
            return request;
          }
          const prefix = `${csrfCookie}=`;
          const entry = document.cookie.split('; ').find((item) => item.startsWith(prefix));
          if (entry) {
            request.headers.set(csrfHeader, decodeURIComponent(entry.slice(prefix.length)));
          }
          return request;
        },
      });
    }
    this.paths = wrapAsPathBasedClient(this.raw);
  }

  private async unwrap<T>(
    pending: Promise<{ data?: T; error?: unknown; response: Response }>,
  ): Promise<T> {
    const result = await pending;
    if (result.error !== undefined || !result.response.ok) {
      const details = result.error;
      const message =
        typeof details === 'string' && details.trim()
          ? details
          : details && typeof details === 'object' && 'message' in details &&
        typeof details.message === 'string'
          ? details.message
          : details && typeof details === 'object' && 'msg' in details &&
        typeof details.msg === 'string'
          ? details.msg
          : this.defaultErrorMessage;
      throw new ApiClientError(message, result.response, details);
    }
    return result.data as T;
  }

  deleteApiCreatorModelsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/creator-models/{id}"].DELETE(...init);
  }

  deleteApiCreatorModelsId(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiCreatorModelsIdRaw(...init));
  }

  deleteApiCreatorV1ProjectsProjectIdSceneSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/session"]["DELETE"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scene/session"].DELETE(...init);
  }

  deleteApiCreatorV1ProjectsProjectIdSceneSession(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/session"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiCreatorV1ProjectsProjectIdSceneSessionRaw(...init));
  }

  deleteApiCreatorV1ProjectsProjectIdStorageScopeSpaceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"]["DELETE"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"].DELETE(...init);
  }

  deleteApiCreatorV1ProjectsProjectIdStorageScopeSpace(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiCreatorV1ProjectsProjectIdStorageScopeSpaceRaw(...init));
  }

  deleteApiLocalAiSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session"]["DELETE"]>
  ) {
    return this.paths["/api/local/ai/session"].DELETE(...init);
  }

  deleteApiLocalAiSession(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiLocalAiSessionRaw(...init));
  }

  deleteApiLocalAiSessionIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/local/ai/session/{id}"].DELETE(...init);
  }

  deleteApiLocalAiSessionId(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiLocalAiSessionIdRaw(...init));
  }

  deleteApiLocalModelsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/local/models/{id}"].DELETE(...init);
  }

  deleteApiLocalModelsId(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiLocalModelsIdRaw(...init));
  }

  deleteApiLocalProjectsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/local-projects/{id}"].DELETE(...init);
  }

  deleteApiLocalProjectsId(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiLocalProjectsIdRaw(...init));
  }

  deleteApiPlayAdminAdminsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/admins/{id}"].DELETE(...init);
  }

  deleteApiPlayAdminAdminsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminAdminsIdRaw(...init));
  }

  deleteApiPlayAdminContainerResourceGroupsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/container-resource-groups/{id}"].DELETE(...init);
  }

  deleteApiPlayAdminContainerResourceGroupsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminContainerResourceGroupsIdRaw(...init));
  }

  deleteApiPlayAdminContainersPermanentMapIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/containers/{permanentMapId}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/containers/{permanentMapId}"].DELETE(...init);
  }

  deleteApiPlayAdminContainersPermanentMapId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/containers/{permanentMapId}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminContainersPermanentMapIdRaw(...init));
  }

  deleteApiPlayAdminImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/import"].DELETE(...init);
  }

  deleteApiPlayAdminImport(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminImportRaw(...init));
  }

  deleteApiPlayAdminLibraryImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/import"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/library/import"].DELETE(...init);
  }

  deleteApiPlayAdminLibraryImport(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/import"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminLibraryImportRaw(...init));
  }

  deleteApiPlayAdminLibrarySectionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/library/{section}"].DELETE(...init);
  }

  deleteApiPlayAdminLibrarySection(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminLibrarySectionRaw(...init));
  }

  deleteApiPlayAdminLibrarySectionIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/library/{section}/{id}"].DELETE(...init);
  }

  deleteApiPlayAdminLibrarySectionId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminLibrarySectionIdRaw(...init));
  }

  deleteApiPlayAdminModelsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/models/{id}"].DELETE(...init);
  }

  deleteApiPlayAdminModelsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminModelsIdRaw(...init));
  }

  deleteApiPlayAdminPermissionGroupsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/permission-groups/{id}"].DELETE(...init);
  }

  deleteApiPlayAdminPermissionGroupsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminPermissionGroupsIdRaw(...init));
  }

  deleteApiPlayAdminPlayersSubjectIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/players/{subjectId}"].DELETE(...init);
  }

  deleteApiPlayAdminPlayersSubjectId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminPlayersSubjectIdRaw(...init));
  }

  deleteApiPlayAdminWorldsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds/{id}"]["DELETE"]>
  ) {
    return this.paths["/api/play-admin/worlds/{id}"].DELETE(...init);
  }

  deleteApiPlayAdminWorldsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds/{id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayAdminWorldsIdRaw(...init));
  }

  deleteApiPlayPresenceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-presence"]["DELETE"]>
  ) {
    return this.paths["/api/play-presence"].DELETE(...init);
  }

  deleteApiPlayPresence(
    ...init: Parameters<PathBasedClient<paths>["/api/play-presence"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiPlayPresenceRaw(...init));
  }

  deleteApiRuntimeContainerIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/runtime/{container_id}"]["DELETE"]>
  ) {
    return this.paths["/api/runtime/{container_id}"].DELETE(...init);
  }

  deleteApiRuntimeContainerId(
    ...init: Parameters<PathBasedClient<paths>["/api/runtime/{container_id}"]["DELETE"]>
  ) {
    return this.unwrap(this.deleteApiRuntimeContainerIdRaw(...init));
  }

  getApiAuthSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/session"]["GET"]>
  ) {
    return this.paths["/api/auth/session"].GET(...init);
  }

  getApiAuthSession(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/session"]["GET"]>
  ) {
    return this.unwrap(this.getApiAuthSessionRaw(...init));
  }

  getApiBackupsArchiveDownloadRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/backups/{archive}/download"]["GET"]>
  ) {
    return this.paths["/api/backups/{archive}/download"].GET(...init);
  }

  getApiBackupsArchiveDownload(
    ...init: Parameters<PathBasedClient<paths>["/api/backups/{archive}/download"]["GET"]>
  ) {
    return this.unwrap(this.getApiBackupsArchiveDownloadRaw(...init));
  }

  getApiConfigSlugRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/config/{slug}"]["GET"]>
  ) {
    return this.paths["/api/config/{slug}"].GET(...init);
  }

  getApiConfigSlug(
    ...init: Parameters<PathBasedClient<paths>["/api/config/{slug}"]["GET"]>
  ) {
    return this.unwrap(this.getApiConfigSlugRaw(...init));
  }

  getApiCreatorModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models"]["GET"]>
  ) {
    return this.paths["/api/creator-models"].GET(...init);
  }

  getApiCreatorModels(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorModelsRaw(...init));
  }

  getApiCreatorModelsBlobsHashRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/blobs/{hash}"]["GET"]>
  ) {
    return this.paths["/api/creator-models/blobs/{hash}"].GET(...init);
  }

  getApiCreatorModelsBlobsHash(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/blobs/{hash}"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorModelsBlobsHashRaw(...init));
  }

  getApiCreatorModelsIdExportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/{id}/export"]["GET"]>
  ) {
    return this.paths["/api/creator-models/{id}/export"].GET(...init);
  }

  getApiCreatorModelsIdExport(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/{id}/export"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorModelsIdExportRaw(...init));
  }

  getApiCreatorPermissionsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-permissions"]["GET"]>
  ) {
    return this.paths["/api/creator-permissions"].GET(...init);
  }

  getApiCreatorPermissions(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-permissions"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorPermissionsRaw(...init));
  }

  getApiCreatorV1HealthRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/health"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/health"].GET(...init);
  }

  getApiCreatorV1Health(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/health"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1HealthRaw(...init));
  }

  getApiCreatorV1ProjectsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects"].GET(...init);
  }

  getApiCreatorV1Projects(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdResourcesRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/resources"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/resources"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdResources(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/resources"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdResourcesRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdRuntimeRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/runtime"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/runtime"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdRuntime(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/runtime"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdRuntimeRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdRuntimeEventsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/runtime/events"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/runtime/events"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdRuntimeEvents(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/runtime/events"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdRuntimeEventsRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdSceneActionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/action"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scene/action"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdSceneAction(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/action"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdSceneActionRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdSceneCaptureRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/capture"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scene/capture"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdSceneCapture(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/capture"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdSceneCaptureRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdSceneSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/session"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scene/session"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdSceneSession(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/session"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdSceneSessionRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdScriptsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scripts"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scripts"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdScripts(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scripts"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdScriptsRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdScriptsSideEntryRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdScriptsSideEntry(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdScriptsSideEntryRaw(...init));
  }

  getApiCreatorV1ProjectsProjectIdStorageScopeSpaceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"]["GET"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"].GET(...init);
  }

  getApiCreatorV1ProjectsProjectIdStorageScopeSpace(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"]["GET"]>
  ) {
    return this.unwrap(this.getApiCreatorV1ProjectsProjectIdStorageScopeSpaceRaw(...init));
  }

  getApiDiagnosticsArchiveDownloadRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/diagnostics/{archive}/download"]["GET"]>
  ) {
    return this.paths["/api/diagnostics/{archive}/download"].GET(...init);
  }

  getApiDiagnosticsArchiveDownload(
    ...init: Parameters<PathBasedClient<paths>["/api/diagnostics/{archive}/download"]["GET"]>
  ) {
    return this.unwrap(this.getApiDiagnosticsArchiveDownloadRaw(...init));
  }

  getApiGetMapInfoRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/getMapInfo"]["GET"]>
  ) {
    return this.paths["/api/getMapInfo"].GET(...init);
  }

  getApiGetMapInfo(
    ...init: Parameters<PathBasedClient<paths>["/api/getMapInfo"]["GET"]>
  ) {
    return this.unwrap(this.getApiGetMapInfoRaw(...init));
  }

  getApiHealthRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/health"]["GET"]>
  ) {
    return this.paths["/api/health"].GET(...init);
  }

  getApiHealth(
    ...init: Parameters<PathBasedClient<paths>["/api/health"]["GET"]>
  ) {
    return this.unwrap(this.getApiHealthRaw(...init));
  }

  getApiHealthCheckRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/health-check"]["GET"]>
  ) {
    return this.paths["/api/health-check"].GET(...init);
  }

  getApiHealthCheck(
    ...init: Parameters<PathBasedClient<paths>["/api/health-check"]["GET"]>
  ) {
    return this.unwrap(this.getApiHealthCheckRaw(...init));
  }

  getApiLocalAiSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session"]["GET"]>
  ) {
    return this.paths["/api/local/ai/session"].GET(...init);
  }

  getApiLocalAiSession(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalAiSessionRaw(...init));
  }

  getApiLocalAiSessionIdCommandsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands"]["GET"]>
  ) {
    return this.paths["/api/local/ai/session/{id}/commands"].GET(...init);
  }

  getApiLocalAiSessionIdCommands(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalAiSessionIdCommandsRaw(...init));
  }

  getApiLocalAiSessionIdCommandsRequestIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands/{requestId}"]["GET"]>
  ) {
    return this.paths["/api/local/ai/session/{id}/commands/{requestId}"].GET(...init);
  }

  getApiLocalAiSessionIdCommandsRequestId(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands/{requestId}"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalAiSessionIdCommandsRequestIdRaw(...init));
  }

  getApiLocalBlobsHashRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/blobs/{hash}"]["GET"]>
  ) {
    return this.paths["/api/local/blobs/{hash}"].GET(...init);
  }

  getApiLocalBlobsHash(
    ...init: Parameters<PathBasedClient<paths>["/api/local/blobs/{hash}"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalBlobsHashRaw(...init));
  }

  getApiLocalDefaultSkinRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/default-skin"]["GET"]>
  ) {
    return this.paths["/api/local/default-skin"].GET(...init);
  }

  getApiLocalDefaultSkin(
    ...init: Parameters<PathBasedClient<paths>["/api/local/default-skin"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalDefaultSkinRaw(...init));
  }

  getApiLocalModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models"]["GET"]>
  ) {
    return this.paths["/api/local/models"].GET(...init);
  }

  getApiLocalModels(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalModelsRaw(...init));
  }

  getApiLocalModelsAuthoringRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/authoring"]["GET"]>
  ) {
    return this.paths["/api/local/models/authoring"].GET(...init);
  }

  getApiLocalModelsAuthoring(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/authoring"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalModelsAuthoringRaw(...init));
  }

  getApiLocalModelsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}"]["GET"]>
  ) {
    return this.paths["/api/local/models/{id}"].GET(...init);
  }

  getApiLocalModelsId(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalModelsIdRaw(...init));
  }

  getApiLocalModelsIdExportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}/export"]["GET"]>
  ) {
    return this.paths["/api/local/models/{id}/export"].GET(...init);
  }

  getApiLocalModelsIdExport(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}/export"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalModelsIdExportRaw(...init));
  }

  getApiLocalModelsIdSnapshotsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}/snapshots"]["GET"]>
  ) {
    return this.paths["/api/local/models/{id}/snapshots"].GET(...init);
  }

  getApiLocalModelsIdSnapshots(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}/snapshots"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalModelsIdSnapshotsRaw(...init));
  }

  getApiLocalProjectsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects"]["GET"]>
  ) {
    return this.paths["/api/local-projects"].GET(...init);
  }

  getApiLocalProjects(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalProjectsRaw(...init));
  }

  getApiLocalProjectsAssetDistributionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/asset-distribution"]["GET"]>
  ) {
    return this.paths["/api/local-projects/asset-distribution"].GET(...init);
  }

  getApiLocalProjectsAssetDistribution(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/asset-distribution"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalProjectsAssetDistributionRaw(...init));
  }

  getApiLocalProjectsIdExportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/export"]["GET"]>
  ) {
    return this.paths["/api/local-projects/{id}/export"].GET(...init);
  }

  getApiLocalProjectsIdExport(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/export"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalProjectsIdExportRaw(...init));
  }

  getApiLocalProjectsIdMapsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/maps"]["GET"]>
  ) {
    return this.paths["/api/local-projects/{id}/maps"].GET(...init);
  }

  getApiLocalProjectsIdMaps(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/maps"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalProjectsIdMapsRaw(...init));
  }

  getApiLocalProjectsIdRuntimeRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/runtime"]["GET"]>
  ) {
    return this.paths["/api/local-projects/{id}/runtime"].GET(...init);
  }

  getApiLocalProjectsIdRuntime(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/runtime"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalProjectsIdRuntimeRaw(...init));
  }

  getApiLocalProjectsIdSnapshotsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/snapshots"]["GET"]>
  ) {
    return this.paths["/api/local-projects/{id}/snapshots"].GET(...init);
  }

  getApiLocalProjectsIdSnapshots(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/snapshots"]["GET"]>
  ) {
    return this.unwrap(this.getApiLocalProjectsIdSnapshotsRaw(...init));
  }

  getApiOperationsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/operations/{id}"]["GET"]>
  ) {
    return this.paths["/api/operations/{id}"].GET(...init);
  }

  getApiOperationsId(
    ...init: Parameters<PathBasedClient<paths>["/api/operations/{id}"]["GET"]>
  ) {
    return this.unwrap(this.getApiOperationsIdRaw(...init));
  }

  getApiPlayAdminActivityRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/activity"]["GET"]>
  ) {
    return this.paths["/api/play-admin/activity"].GET(...init);
  }

  getApiPlayAdminActivity(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/activity"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminActivityRaw(...init));
  }

  getApiPlayAdminAdminsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins"]["GET"]>
  ) {
    return this.paths["/api/play-admin/admins"].GET(...init);
  }

  getApiPlayAdminAdmins(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminAdminsRaw(...init));
  }

  getApiPlayAdminContainerResourceGroupsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups"]["GET"]>
  ) {
    return this.paths["/api/play-admin/container-resource-groups"].GET(...init);
  }

  getApiPlayAdminContainerResourceGroups(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminContainerResourceGroupsRaw(...init));
  }

  getApiPlayAdminContainersRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/containers"]["GET"]>
  ) {
    return this.paths["/api/play-admin/containers"].GET(...init);
  }

  getApiPlayAdminContainers(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/containers"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminContainersRaw(...init));
  }

  getApiPlayAdminIdentityBansRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/identity-bans"]["GET"]>
  ) {
    return this.paths["/api/play-admin/identity-bans"].GET(...init);
  }

  getApiPlayAdminIdentityBans(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/identity-bans"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminIdentityBansRaw(...init));
  }

  getApiPlayAdminImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import"]["GET"]>
  ) {
    return this.paths["/api/play-admin/import"].GET(...init);
  }

  getApiPlayAdminImport(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminImportRaw(...init));
  }

  getApiPlayAdminImportResourceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import-resource"]["GET"]>
  ) {
    return this.paths["/api/play-admin/import-resource"].GET(...init);
  }

  getApiPlayAdminImportResource(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import-resource"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminImportResourceRaw(...init));
  }

  getApiPlayAdminLibraryImportRaw<const Init extends Parameters<PathBasedClient<paths>["/api/play-admin/library/import"]["GET"]>>(...init: Init): Promise<FetchResponse<paths["/api/play-admin/library/import"]["get"], Init[0], `${string}/${string}`>> {
    // Preserve parseAs when callers download text or binary resources.
    return this.paths["/api/play-admin/library/import"].GET(...(init as Parameters<PathBasedClient<paths>["/api/play-admin/library/import"]["GET"]>)) as Promise<FetchResponse<paths["/api/play-admin/library/import"]["get"], Init[0], `${string}/${string}`>>;
  }

  getApiPlayAdminLibraryImport<const Init extends Parameters<PathBasedClient<paths>["/api/play-admin/library/import"]["GET"]>>(...init: Init): Promise<NonNullable<FetchResponse<paths["/api/play-admin/library/import"]["get"], Init[0], `${string}/${string}`>["data"]>> {
    return this.unwrap(this.getApiPlayAdminLibraryImportRaw(...init)) as Promise<NonNullable<FetchResponse<paths["/api/play-admin/library/import"]["get"], Init[0], `${string}/${string}`>["data"]>>;
  }

  getApiPlayAdminLibrarySectionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["GET"]>
  ) {
    return this.paths["/api/play-admin/library/{section}"].GET(...init);
  }

  getApiPlayAdminLibrarySection(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminLibrarySectionRaw(...init));
  }

  getApiPlayAdminLibrarySectionIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["GET"]>
  ) {
    return this.paths["/api/play-admin/library/{section}/{id}"].GET(...init);
  }

  getApiPlayAdminLibrarySectionId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminLibrarySectionIdRaw(...init));
  }

  getApiPlayAdminModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models"]["GET"]>
  ) {
    return this.paths["/api/play-admin/models"].GET(...init);
  }

  getApiPlayAdminModels(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminModelsRaw(...init));
  }

  getApiPlayAdminPermissionGroupsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups"]["GET"]>
  ) {
    return this.paths["/api/play-admin/permission-groups"].GET(...init);
  }

  getApiPlayAdminPermissionGroups(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminPermissionGroupsRaw(...init));
  }

  getApiPlayAdminPlayersRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players"]["GET"]>
  ) {
    return this.paths["/api/play-admin/players"].GET(...init);
  }

  getApiPlayAdminPlayers(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminPlayersRaw(...init));
  }

  getApiPlayAdminPlayersExportRaw<const Init extends Parameters<PathBasedClient<paths>["/api/play-admin/players/export"]["GET"]>>(...init: Init): Promise<FetchResponse<paths["/api/play-admin/players/export"]["get"], Init[0], `${string}/${string}`>> {
    // Preserve parseAs when callers download text or binary resources.
    return this.paths["/api/play-admin/players/export"].GET(...(init as Parameters<PathBasedClient<paths>["/api/play-admin/players/export"]["GET"]>)) as Promise<FetchResponse<paths["/api/play-admin/players/export"]["get"], Init[0], `${string}/${string}`>>;
  }

  getApiPlayAdminPlayersExport<const Init extends Parameters<PathBasedClient<paths>["/api/play-admin/players/export"]["GET"]>>(...init: Init): Promise<NonNullable<FetchResponse<paths["/api/play-admin/players/export"]["get"], Init[0], `${string}/${string}`>["data"]>> {
    return this.unwrap(this.getApiPlayAdminPlayersExportRaw(...init)) as Promise<NonNullable<FetchResponse<paths["/api/play-admin/players/export"]["get"], Init[0], `${string}/${string}`>["data"]>>;
  }

  getApiPlayAdminPlayersOverviewRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/overview"]["GET"]>
  ) {
    return this.paths["/api/play-admin/players/overview"].GET(...init);
  }

  getApiPlayAdminPlayersOverview(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/overview"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminPlayersOverviewRaw(...init));
  }

  getApiPlayAdminPlayersSubjectIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["GET"]>
  ) {
    return this.paths["/api/play-admin/players/{subjectId}"].GET(...init);
  }

  getApiPlayAdminPlayersSubjectId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminPlayersSubjectIdRaw(...init));
  }

  getApiPlayAdminScriptModerationRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/script-moderation"]["GET"]>
  ) {
    return this.paths["/api/play-admin/script-moderation"].GET(...init);
  }

  getApiPlayAdminScriptModeration(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/script-moderation"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminScriptModerationRaw(...init));
  }

  getApiPlayAdminStatusRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/status"]["GET"]>
  ) {
    return this.paths["/api/play-admin/status"].GET(...init);
  }

  getApiPlayAdminStatus(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/status"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminStatusRaw(...init));
  }

  getApiPlayAdminVerifyRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/verify"]["GET"]>
  ) {
    return this.paths["/api/play-admin/verify"].GET(...init);
  }

  getApiPlayAdminVerify(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/verify"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminVerifyRaw(...init));
  }

  getApiPlayAdminWorldsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds"]["GET"]>
  ) {
    return this.paths["/api/play-admin/worlds"].GET(...init);
  }

  getApiPlayAdminWorlds(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminWorldsRaw(...init));
  }

  getApiPlayAdminWorldsStatusRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds/status"]["GET"]>
  ) {
    return this.paths["/api/play-admin/worlds/status"].GET(...init);
  }

  getApiPlayAdminWorldsStatus(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds/status"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayAdminWorldsStatusRaw(...init));
  }

  getApiPlayerAuthLoginRequiredRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/login-required"]["GET"]>
  ) {
    return this.paths["/api/player-auth/login-required"].GET(...init);
  }

  getApiPlayerAuthLoginRequired(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/login-required"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerAuthLoginRequiredRaw(...init));
  }

  getApiPlayerAuthSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/session"]["GET"]>
  ) {
    return this.paths["/api/player-auth/session"].GET(...init);
  }

  getApiPlayerAuthSession(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/session"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerAuthSessionRaw(...init));
  }

  getApiPlayerInternalMapLibraryRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/map-library"]["GET"]>
  ) {
    return this.paths["/api/player-internal/map-library"].GET(...init);
  }

  getApiPlayerInternalMapLibrary(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/map-library"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerInternalMapLibraryRaw(...init));
  }

  getApiPlayerInternalRevocationsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/revocations"]["GET"]>
  ) {
    return this.paths["/api/player-internal/revocations"].GET(...init);
  }

  getApiPlayerInternalRevocations(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/revocations"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerInternalRevocationsRaw(...init));
  }

  getApiPlayerLauncherBootstrapRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/bootstrap"]["GET"]>
  ) {
    return this.paths["/api/player-launcher/bootstrap"].GET(...init);
  }

  getApiPlayerLauncherBootstrap(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/bootstrap"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerLauncherBootstrapRaw(...init));
  }

  getApiPlayerLauncherMapsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/maps"]["GET"]>
  ) {
    return this.paths["/api/player-launcher/maps"].GET(...init);
  }

  getApiPlayerLauncherMaps(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/maps"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerLauncherMapsRaw(...init));
  }

  getApiPlayerLauncherMapsMapIdDescriptorRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/maps/{mapId}/descriptor"]["GET"]>
  ) {
    return this.paths["/api/player-launcher/maps/{mapId}/descriptor"].GET(...init);
  }

  getApiPlayerLauncherMapsMapIdDescriptor(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/maps/{mapId}/descriptor"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerLauncherMapsMapIdDescriptorRaw(...init));
  }

  getApiPlayerLauncherMapsMapIdDownloadPlanRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/maps/{mapId}/download-plan"]["GET"]>
  ) {
    return this.paths["/api/player-launcher/maps/{mapId}/download-plan"].GET(...init);
  }

  getApiPlayerLauncherMapsMapIdDownloadPlan(
    ...init: Parameters<PathBasedClient<paths>["/api/player-launcher/maps/{mapId}/download-plan"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerLauncherMapsMapIdDownloadPlanRaw(...init));
  }

  getApiPlayerLoginCallbackRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-login/callback"]["GET"]>
  ) {
    return this.paths["/api/player-login/callback"].GET(...init);
  }

  getApiPlayerLoginCallback(
    ...init: Parameters<PathBasedClient<paths>["/api/player-login/callback"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerLoginCallbackRaw(...init));
  }

  getApiPlayerLoginStartRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-login/start"]["GET"]>
  ) {
    return this.paths["/api/player-login/start"].GET(...init);
  }

  getApiPlayerLoginStart(
    ...init: Parameters<PathBasedClient<paths>["/api/player-login/start"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayerLoginStartRaw(...init));
  }

  getApiPlayLibraryRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-library"]["GET"]>
  ) {
    return this.paths["/api/play-library"].GET(...init);
  }

  getApiPlayLibrary(
    ...init: Parameters<PathBasedClient<paths>["/api/play-library"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayLibraryRaw(...init));
  }

  getApiPlayModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-models"]["GET"]>
  ) {
    return this.paths["/api/play-models"].GET(...init);
  }

  getApiPlayModels(
    ...init: Parameters<PathBasedClient<paths>["/api/play-models"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayModelsRaw(...init));
  }

  getApiPlayModelsIdRaw<const Init extends Parameters<PathBasedClient<paths>["/api/play-models/{id}"]["GET"]>>(...init: Init): Promise<FetchResponse<paths["/api/play-models/{id}"]["get"], Init[0], `${string}/${string}`>> {
    // Preserve parseAs when callers download text or binary resources.
    return this.paths["/api/play-models/{id}"].GET(...(init as Parameters<PathBasedClient<paths>["/api/play-models/{id}"]["GET"]>)) as Promise<FetchResponse<paths["/api/play-models/{id}"]["get"], Init[0], `${string}/${string}`>>;
  }

  getApiPlayModelsId<const Init extends Parameters<PathBasedClient<paths>["/api/play-models/{id}"]["GET"]>>(...init: Init): Promise<NonNullable<FetchResponse<paths["/api/play-models/{id}"]["get"], Init[0], `${string}/${string}`>["data"]>> {
    return this.unwrap(this.getApiPlayModelsIdRaw(...init)) as Promise<NonNullable<FetchResponse<paths["/api/play-models/{id}"]["get"], Init[0], `${string}/${string}`>["data"]>>;
  }

  getApiPlayPresenceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-presence"]["GET"]>
  ) {
    return this.paths["/api/play-presence"].GET(...init);
  }

  getApiPlayPresence(
    ...init: Parameters<PathBasedClient<paths>["/api/play-presence"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayPresenceRaw(...init));
  }

  getApiPlayResourceCacheWorldRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-resource-cache/{world}"]["GET"]>
  ) {
    return this.paths["/api/play-resource-cache/{world}"].GET(...init);
  }

  getApiPlayResourceCacheWorld(
    ...init: Parameters<PathBasedClient<paths>["/api/play-resource-cache/{world}"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayResourceCacheWorldRaw(...init));
  }

  getApiPlayWorldsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-worlds"]["GET"]>
  ) {
    return this.paths["/api/play-worlds"].GET(...init);
  }

  getApiPlayWorlds(
    ...init: Parameters<PathBasedClient<paths>["/api/play-worlds"]["GET"]>
  ) {
    return this.unwrap(this.getApiPlayWorldsRaw(...init));
  }

  getApiProjectModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/project-models"]["GET"]>
  ) {
    return this.paths["/api/project-models"].GET(...init);
  }

  getApiProjectModels(
    ...init: Parameters<PathBasedClient<paths>["/api/project-models"]["GET"]>
  ) {
    return this.unwrap(this.getApiProjectModelsRaw(...init));
  }

  getApiProjectSkinPreviewsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/project-skin-previews"]["GET"]>
  ) {
    return this.paths["/api/project-skin-previews"].GET(...init);
  }

  getApiProjectSkinPreviews(
    ...init: Parameters<PathBasedClient<paths>["/api/project-skin-previews"]["GET"]>
  ) {
    return this.unwrap(this.getApiProjectSkinPreviewsRaw(...init));
  }

  getApiProjectSkinsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/project-skins"]["GET"]>
  ) {
    return this.paths["/api/project-skins"].GET(...init);
  }

  getApiProjectSkins(
    ...init: Parameters<PathBasedClient<paths>["/api/project-skins"]["GET"]>
  ) {
    return this.unwrap(this.getApiProjectSkinsRaw(...init));
  }

  getApiRuntimeContainerIdStatsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/runtime/{container_id}/stats"]["GET"]>
  ) {
    return this.paths["/api/runtime/{container_id}/stats"].GET(...init);
  }

  getApiRuntimeContainerIdStats(
    ...init: Parameters<PathBasedClient<paths>["/api/runtime/{container_id}/stats"]["GET"]>
  ) {
    return this.unwrap(this.getApiRuntimeContainerIdStatsRaw(...init));
  }

  getApiServerInfoRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/server-info"]["GET"]>
  ) {
    return this.paths["/api/server-info"].GET(...init);
  }

  getApiServerInfo(
    ...init: Parameters<PathBasedClient<paths>["/api/server-info"]["GET"]>
  ) {
    return this.unwrap(this.getApiServerInfoRaw(...init));
  }

  getApiSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/session"]["GET"]>
  ) {
    return this.paths["/api/session"].GET(...init);
  }

  getApiSession(
    ...init: Parameters<PathBasedClient<paths>["/api/session"]["GET"]>
  ) {
    return this.unwrap(this.getApiSessionRaw(...init));
  }

  getApiSystemBackupsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/system/backups"]["GET"]>
  ) {
    return this.paths["/api/system/backups"].GET(...init);
  }

  getApiSystemBackups(
    ...init: Parameters<PathBasedClient<paths>["/api/system/backups"]["GET"]>
  ) {
    return this.unwrap(this.getApiSystemBackupsRaw(...init));
  }

  getApiSystemBackupsProjectIdNameRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/system/backups/{projectId}/{name}"]["GET"]>
  ) {
    return this.paths["/api/system/backups/{projectId}/{name}"].GET(...init);
  }

  getApiSystemBackupsProjectIdName(
    ...init: Parameters<PathBasedClient<paths>["/api/system/backups/{projectId}/{name}"]["GET"]>
  ) {
    return this.unwrap(this.getApiSystemBackupsProjectIdNameRaw(...init));
  }

  getApiSystemStatusRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/system/status"]["GET"]>
  ) {
    return this.paths["/api/system/status"].GET(...init);
  }

  getApiSystemStatus(
    ...init: Parameters<PathBasedClient<paths>["/api/system/status"]["GET"]>
  ) {
    return this.unwrap(this.getApiSystemStatusRaw(...init));
  }

  getBlockHashRaw(
    ...init: Parameters<PathBasedClient<paths>["/block/{hash}"]["GET"]>
  ) {
    return this.paths["/block/{hash}"].GET(...init);
  }

  getBlockHash(
    ...init: Parameters<PathBasedClient<paths>["/block/{hash}"]["GET"]>
  ) {
    return this.unwrap(this.getBlockHashRaw(...init));
  }

  getInternalCreatorPreviewRuntimeRaw(
    ...init: Parameters<PathBasedClient<paths>["/internal/creator-preview-runtime"]["GET"]>
  ) {
    return this.paths["/internal/creator-preview-runtime"].GET(...init);
  }

  getInternalCreatorPreviewRuntime(
    ...init: Parameters<PathBasedClient<paths>["/internal/creator-preview-runtime"]["GET"]>
  ) {
    return this.unwrap(this.getInternalCreatorPreviewRuntimeRaw(...init));
  }

  getInternalCreatorPreviewRuntimeEventsRaw(
    ...init: Parameters<PathBasedClient<paths>["/internal/creator-preview-runtime/events"]["GET"]>
  ) {
    return this.paths["/internal/creator-preview-runtime/events"].GET(...init);
  }

  getInternalCreatorPreviewRuntimeEvents(
    ...init: Parameters<PathBasedClient<paths>["/internal/creator-preview-runtime/events"]["GET"]>
  ) {
    return this.unwrap(this.getInternalCreatorPreviewRuntimeEventsRaw(...init));
  }

  getLocalRuntimeStatusRaw(
    ...init: Parameters<PathBasedClient<paths>["/__local_runtime/status"]["GET"]>
  ) {
    return this.paths["/__local_runtime/status"].GET(...init);
  }

  getLocalRuntimeStatus(
    ...init: Parameters<PathBasedClient<paths>["/__local_runtime/status"]["GET"]>
  ) {
    return this.unwrap(this.getLocalRuntimeStatusRaw(...init));
  }

  patchApiAuthProfileRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/profile"]["PATCH"]>
  ) {
    return this.paths["/api/auth/profile"].PATCH(...init);
  }

  patchApiAuthProfile(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/profile"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiAuthProfileRaw(...init));
  }

  patchApiCreatorProfileRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-profile"]["PATCH"]>
  ) {
    return this.paths["/api/creator-profile"].PATCH(...init);
  }

  patchApiCreatorProfile(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-profile"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiCreatorProfileRaw(...init));
  }

  patchApiLocalProjectsAssetDistributionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/asset-distribution"]["PATCH"]>
  ) {
    return this.paths["/api/local-projects/asset-distribution"].PATCH(...init);
  }

  patchApiLocalProjectsAssetDistribution(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/asset-distribution"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiLocalProjectsAssetDistributionRaw(...init));
  }

  patchApiLocalProjectsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}"]["PATCH"]>
  ) {
    return this.paths["/api/local-projects/{id}"].PATCH(...init);
  }

  patchApiLocalProjectsId(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiLocalProjectsIdRaw(...init));
  }

  patchApiPlayAdminAdminsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins/{id}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/admins/{id}"].PATCH(...init);
  }

  patchApiPlayAdminAdminsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins/{id}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminAdminsIdRaw(...init));
  }

  patchApiPlayAdminContainerResourceGroupsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups/{id}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/container-resource-groups/{id}"].PATCH(...init);
  }

  patchApiPlayAdminContainerResourceGroupsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups/{id}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminContainerResourceGroupsIdRaw(...init));
  }

  patchApiPlayAdminLibrarySectionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/library/{section}"].PATCH(...init);
  }

  patchApiPlayAdminLibrarySection(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminLibrarySectionRaw(...init));
  }

  patchApiPlayAdminLibrarySectionIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/library/{section}/{id}"].PATCH(...init);
  }

  patchApiPlayAdminLibrarySectionId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminLibrarySectionIdRaw(...init));
  }

  patchApiPlayAdminModelsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models/{id}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/models/{id}"].PATCH(...init);
  }

  patchApiPlayAdminModelsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models/{id}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminModelsIdRaw(...init));
  }

  patchApiPlayAdminPermissionGroupsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups/{id}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/permission-groups/{id}"].PATCH(...init);
  }

  patchApiPlayAdminPermissionGroupsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups/{id}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminPermissionGroupsIdRaw(...init));
  }

  patchApiPlayAdminPlayersSubjectIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/players/{subjectId}"].PATCH(...init);
  }

  patchApiPlayAdminPlayersSubjectId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminPlayersSubjectIdRaw(...init));
  }

  patchApiPlayAdminWorldsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds/{id}"]["PATCH"]>
  ) {
    return this.paths["/api/play-admin/worlds/{id}"].PATCH(...init);
  }

  patchApiPlayAdminWorldsId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/worlds/{id}"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayAdminWorldsIdRaw(...init));
  }

  patchApiPlayerAuthProfileRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/profile"]["PATCH"]>
  ) {
    return this.paths["/api/player-auth/profile"].PATCH(...init);
  }

  patchApiPlayerAuthProfile(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/profile"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayerAuthProfileRaw(...init));
  }

  patchApiPlayerInternalMapLibraryRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/map-library"]["PATCH"]>
  ) {
    return this.paths["/api/player-internal/map-library"].PATCH(...init);
  }

  patchApiPlayerInternalMapLibrary(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/map-library"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayerInternalMapLibraryRaw(...init));
  }

  patchApiPlayerInternalProfileRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/profile"]["PATCH"]>
  ) {
    return this.paths["/api/player-internal/profile"].PATCH(...init);
  }

  patchApiPlayerInternalProfile(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/profile"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayerInternalProfileRaw(...init));
  }

  patchApiPlayLibraryRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-library"]["PATCH"]>
  ) {
    return this.paths["/api/play-library"].PATCH(...init);
  }

  patchApiPlayLibrary(
    ...init: Parameters<PathBasedClient<paths>["/api/play-library"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayLibraryRaw(...init));
  }

  patchApiPlayProfileRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-profile"]["PATCH"]>
  ) {
    return this.paths["/api/play-profile"].PATCH(...init);
  }

  patchApiPlayProfile(
    ...init: Parameters<PathBasedClient<paths>["/api/play-profile"]["PATCH"]>
  ) {
    return this.unwrap(this.patchApiPlayProfileRaw(...init));
  }

  postApiAuthLoginRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/login"]["POST"]>
  ) {
    return this.paths["/api/auth/login"].POST(...init);
  }

  postApiAuthLogin(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/login"]["POST"]>
  ) {
    return this.unwrap(this.postApiAuthLoginRaw(...init));
  }

  postApiAuthLogoutRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/logout"]["POST"]>
  ) {
    return this.paths["/api/auth/logout"].POST(...init);
  }

  postApiAuthLogout(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/logout"]["POST"]>
  ) {
    return this.unwrap(this.postApiAuthLogoutRaw(...init));
  }

  postApiAuthPasswordRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/password"]["POST"]>
  ) {
    return this.paths["/api/auth/password"].POST(...init);
  }

  postApiAuthPassword(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/password"]["POST"]>
  ) {
    return this.unwrap(this.postApiAuthPasswordRaw(...init));
  }

  postApiAuthRegisterRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/register"]["POST"]>
  ) {
    return this.paths["/api/auth/register"].POST(...init);
  }

  postApiAuthRegister(
    ...init: Parameters<PathBasedClient<paths>["/api/auth/register"]["POST"]>
  ) {
    return this.unwrap(this.postApiAuthRegisterRaw(...init));
  }

  postApiBackupsUploadRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/backups/upload"]["POST"]>
  ) {
    return this.paths["/api/backups/upload"].POST(...init);
  }

  postApiBackupsUpload(
    ...init: Parameters<PathBasedClient<paths>["/api/backups/upload"]["POST"]>
  ) {
    return this.unwrap(this.postApiBackupsUploadRaw(...init));
  }

  postApiCommandsNameRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/commands/{name}"]["POST"]>
  ) {
    return this.paths["/api/commands/{name}"].POST(...init);
  }

  postApiCommandsName(
    ...init: Parameters<PathBasedClient<paths>["/api/commands/{name}"]["POST"]>
  ) {
    return this.unwrap(this.postApiCommandsNameRaw(...init));
  }

  postApiCreateSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/createSession"]["POST"]>
  ) {
    return this.paths["/api/createSession"].POST(...init);
  }

  postApiCreateSession(
    ...init: Parameters<PathBasedClient<paths>["/api/createSession"]["POST"]>
  ) {
    return this.unwrap(this.postApiCreateSessionRaw(...init));
  }

  postApiCreatorLogoutRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-logout"]["POST"]>
  ) {
    return this.paths["/api/creator-logout"].POST(...init);
  }

  postApiCreatorLogout(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-logout"]["POST"]>
  ) {
    return this.unwrap(this.postApiCreatorLogoutRaw(...init));
  }

  postApiCreatorModelsImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/import"]["POST"]>
  ) {
    return this.paths["/api/creator-models/import"].POST(...init);
  }

  postApiCreatorModelsImport(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/import"]["POST"]>
  ) {
    return this.unwrap(this.postApiCreatorModelsImportRaw(...init));
  }

  postApiCreatorV1ProjectsProjectIdRuntimeRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/runtime"]["POST"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/runtime"].POST(...init);
  }

  postApiCreatorV1ProjectsProjectIdRuntime(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/runtime"]["POST"]>
  ) {
    return this.unwrap(this.postApiCreatorV1ProjectsProjectIdRuntimeRaw(...init));
  }

  postApiCreatorV1ProjectsProjectIdSceneActionsRequestIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/actions/{requestId}"]["POST"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scene/actions/{requestId}"].POST(...init);
  }

  postApiCreatorV1ProjectsProjectIdSceneActionsRequestId(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/actions/{requestId}"]["POST"]>
  ) {
    return this.unwrap(this.postApiCreatorV1ProjectsProjectIdSceneActionsRequestIdRaw(...init));
  }

  postApiCreatorV1ProjectsProjectIdSceneSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/session"]["POST"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scene/session"].POST(...init);
  }

  postApiCreatorV1ProjectsProjectIdSceneSession(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scene/session"]["POST"]>
  ) {
    return this.unwrap(this.postApiCreatorV1ProjectsProjectIdSceneSessionRaw(...init));
  }

  postApiLocalAiSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session"]["POST"]>
  ) {
    return this.paths["/api/local/ai/session"].POST(...init);
  }

  postApiLocalAiSession(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalAiSessionRaw(...init));
  }

  postApiLocalAiSessionIdCommandsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands"]["POST"]>
  ) {
    return this.paths["/api/local/ai/session/{id}/commands"].POST(...init);
  }

  postApiLocalAiSessionIdCommands(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalAiSessionIdCommandsRaw(...init));
  }

  postApiLocalAiSessionIdCommandsRequestIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands/{requestId}"]["POST"]>
  ) {
    return this.paths["/api/local/ai/session/{id}/commands/{requestId}"].POST(...init);
  }

  postApiLocalAiSessionIdCommandsRequestId(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/session/{id}/commands/{requestId}"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalAiSessionIdCommandsRequestIdRaw(...init));
  }

  postApiLocalAiSocketRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/socket"]["POST"]>
  ) {
    return this.paths["/api/local/ai/socket"].POST(...init);
  }

  postApiLocalAiSocket(
    ...init: Parameters<PathBasedClient<paths>["/api/local/ai/socket"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalAiSocketRaw(...init));
  }

  postApiLocalAnimationPreviewRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/animation-preview"]["POST"]>
  ) {
    return this.paths["/api/local/animation-preview"].POST(...init);
  }

  postApiLocalAnimationPreview(
    ...init: Parameters<PathBasedClient<paths>["/api/local/animation-preview"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalAnimationPreviewRaw(...init));
  }

  postApiLocalBlobRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/blob"]["POST"]>
  ) {
    return this.paths["/api/local/blob"].POST(...init);
  }

  postApiLocalBlob(
    ...init: Parameters<PathBasedClient<paths>["/api/local/blob"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalBlobRaw(...init));
  }

  postApiLocalModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models"]["POST"]>
  ) {
    return this.paths["/api/local/models"].POST(...init);
  }

  postApiLocalModels(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalModelsRaw(...init));
  }

  postApiLocalModelsAuthoringRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/authoring"]["POST"]>
  ) {
    return this.paths["/api/local/models/authoring"].POST(...init);
  }

  postApiLocalModelsAuthoring(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/authoring"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalModelsAuthoringRaw(...init));
  }

  postApiLocalModelsImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/import"]["POST"]>
  ) {
    return this.paths["/api/local/models/import"].POST(...init);
  }

  postApiLocalModelsImport(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/import"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalModelsImportRaw(...init));
  }

  postApiLocalModelsRenderSheetRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/render-sheet"]["POST"]>
  ) {
    return this.paths["/api/local/models/render-sheet"].POST(...init);
  }

  postApiLocalModelsRenderSheet(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/render-sheet"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalModelsRenderSheetRaw(...init));
  }

  postApiLocalProjectsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects"]["POST"]>
  ) {
    return this.paths["/api/local-projects"].POST(...init);
  }

  postApiLocalProjects(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsRaw(...init));
  }

  postApiLocalProjectsIdExpandRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/expand"]["POST"]>
  ) {
    return this.paths["/api/local-projects/{id}/expand"].POST(...init);
  }

  postApiLocalProjectsIdExpand(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/expand"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsIdExpandRaw(...init));
  }

  postApiLocalProjectsIdMapsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/maps"]["POST"]>
  ) {
    return this.paths["/api/local-projects/{id}/maps"].POST(...init);
  }

  postApiLocalProjectsIdMaps(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/maps"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsIdMapsRaw(...init));
  }

  postApiLocalProjectsIdPackageRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/package"]["POST"]>
  ) {
    return this.paths["/api/local-projects/{id}/package"].POST(...init);
  }

  postApiLocalProjectsIdPackage(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/package"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsIdPackageRaw(...init));
  }

  postApiLocalProjectsIdPublishRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/publish"]["POST"]>
  ) {
    return this.paths["/api/local-projects/{id}/publish"].POST(...init);
  }

  postApiLocalProjectsIdPublish(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/publish"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsIdPublishRaw(...init));
  }

  postApiLocalProjectsIdRuntimeRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/runtime"]["POST"]>
  ) {
    return this.paths["/api/local-projects/{id}/runtime"].POST(...init);
  }

  postApiLocalProjectsIdRuntime(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/runtime"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsIdRuntimeRaw(...init));
  }

  postApiLocalProjectsIdSnapshotsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/snapshots"]["POST"]>
  ) {
    return this.paths["/api/local-projects/{id}/snapshots"].POST(...init);
  }

  postApiLocalProjectsIdSnapshots(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/{id}/snapshots"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsIdSnapshotsRaw(...init));
  }

  postApiLocalProjectsImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/import"]["POST"]>
  ) {
    return this.paths["/api/local-projects/import"].POST(...init);
  }

  postApiLocalProjectsImport(
    ...init: Parameters<PathBasedClient<paths>["/api/local-projects/import"]["POST"]>
  ) {
    return this.unwrap(this.postApiLocalProjectsImportRaw(...init));
  }

  postApiPlayAdminAdminsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins"]["POST"]>
  ) {
    return this.paths["/api/play-admin/admins"].POST(...init);
  }

  postApiPlayAdminAdmins(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/admins"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminAdminsRaw(...init));
  }

  postApiPlayAdminContainerResourceGroupsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups"]["POST"]>
  ) {
    return this.paths["/api/play-admin/container-resource-groups"].POST(...init);
  }

  postApiPlayAdminContainerResourceGroups(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/container-resource-groups"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminContainerResourceGroupsRaw(...init));
  }

  postApiPlayAdminContainersRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/containers"]["POST"]>
  ) {
    return this.paths["/api/play-admin/containers"].POST(...init);
  }

  postApiPlayAdminContainers(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/containers"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminContainersRaw(...init));
  }

  postApiPlayAdminIdentityBansRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/identity-bans"]["POST"]>
  ) {
    return this.paths["/api/play-admin/identity-bans"].POST(...init);
  }

  postApiPlayAdminIdentityBans(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/identity-bans"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminIdentityBansRaw(...init));
  }

  postApiPlayAdminImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import"]["POST"]>
  ) {
    return this.paths["/api/play-admin/import"].POST(...init);
  }

  postApiPlayAdminImport(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/import"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminImportRaw(...init));
  }

  postApiPlayAdminLibraryImportRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/import"]["POST"]>
  ) {
    return this.paths["/api/play-admin/library/import"].POST(...init);
  }

  postApiPlayAdminLibraryImport(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/import"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminLibraryImportRaw(...init));
  }

  postApiPlayAdminLibrarySectionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["POST"]>
  ) {
    return this.paths["/api/play-admin/library/{section}"].POST(...init);
  }

  postApiPlayAdminLibrarySection(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminLibrarySectionRaw(...init));
  }

  postApiPlayAdminLibrarySectionIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["POST"]>
  ) {
    return this.paths["/api/play-admin/library/{section}/{id}"].POST(...init);
  }

  postApiPlayAdminLibrarySectionId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/library/{section}/{id}"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminLibrarySectionIdRaw(...init));
  }

  postApiPlayAdminLoginRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/login"]["POST"]>
  ) {
    return this.paths["/api/play-admin/login"].POST(...init);
  }

  postApiPlayAdminLogin(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/login"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminLoginRaw(...init));
  }

  postApiPlayAdminLogoutRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/logout"]["POST"]>
  ) {
    return this.paths["/api/play-admin/logout"].POST(...init);
  }

  postApiPlayAdminLogout(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/logout"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminLogoutRaw(...init));
  }

  postApiPlayAdminMaintenanceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/maintenance"]["POST"]>
  ) {
    return this.paths["/api/play-admin/maintenance"].POST(...init);
  }

  postApiPlayAdminMaintenance(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/maintenance"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminMaintenanceRaw(...init));
  }

  postApiPlayAdminModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models"]["POST"]>
  ) {
    return this.paths["/api/play-admin/models"].POST(...init);
  }

  postApiPlayAdminModels(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/models"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminModelsRaw(...init));
  }

  postApiPlayAdminOwnerSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/owner-session"]["POST"]>
  ) {
    return this.paths["/api/play-admin/owner-session"].POST(...init);
  }

  postApiPlayAdminOwnerSession(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/owner-session"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminOwnerSessionRaw(...init));
  }

  postApiPlayAdminPermissionGroupsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups"]["POST"]>
  ) {
    return this.paths["/api/play-admin/permission-groups"].POST(...init);
  }

  postApiPlayAdminPermissionGroups(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/permission-groups"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminPermissionGroupsRaw(...init));
  }

  postApiPlayAdminPlayersRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players"]["POST"]>
  ) {
    return this.paths["/api/play-admin/players"].POST(...init);
  }

  postApiPlayAdminPlayers(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminPlayersRaw(...init));
  }

  postApiPlayAdminPlayersBatchRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/batch"]["POST"]>
  ) {
    return this.paths["/api/play-admin/players/batch"].POST(...init);
  }

  postApiPlayAdminPlayersBatch(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/batch"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminPlayersBatchRaw(...init));
  }

  postApiPlayAdminPlayersSubjectIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["POST"]>
  ) {
    return this.paths["/api/play-admin/players/{subjectId}"].POST(...init);
  }

  postApiPlayAdminPlayersSubjectId(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/players/{subjectId}"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminPlayersSubjectIdRaw(...init));
  }

  postApiPlayAdminScriptModerationRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/script-moderation"]["POST"]>
  ) {
    return this.paths["/api/play-admin/script-moderation"].POST(...init);
  }

  postApiPlayAdminScriptModeration(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/script-moderation"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminScriptModerationRaw(...init));
  }

  postApiPlayAdminSelfPasswordRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/self-password"]["POST"]>
  ) {
    return this.paths["/api/play-admin/self-password"].POST(...init);
  }

  postApiPlayAdminSelfPassword(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/self-password"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminSelfPasswordRaw(...init));
  }

  postApiPlayAdminVerifyRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/verify"]["POST"]>
  ) {
    return this.paths["/api/play-admin/verify"].POST(...init);
  }

  postApiPlayAdminVerify(
    ...init: Parameters<PathBasedClient<paths>["/api/play-admin/verify"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayAdminVerifyRaw(...init));
  }

  postApiPlayerAuthLoginRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/login"]["POST"]>
  ) {
    return this.paths["/api/player-auth/login"].POST(...init);
  }

  postApiPlayerAuthLogin(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/login"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerAuthLoginRaw(...init));
  }

  postApiPlayerAuthLogoutRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/logout"]["POST"]>
  ) {
    return this.paths["/api/player-auth/logout"].POST(...init);
  }

  postApiPlayerAuthLogout(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/logout"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerAuthLogoutRaw(...init));
  }

  postApiPlayerAuthPasswordRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/password"]["POST"]>
  ) {
    return this.paths["/api/player-auth/password"].POST(...init);
  }

  postApiPlayerAuthPassword(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/password"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerAuthPasswordRaw(...init));
  }

  postApiPlayerAuthRegisterRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/register"]["POST"]>
  ) {
    return this.paths["/api/player-auth/register"].POST(...init);
  }

  postApiPlayerAuthRegister(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/register"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerAuthRegisterRaw(...init));
  }

  postApiPlayerAuthTransferRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/transfer"]["POST"]>
  ) {
    return this.paths["/api/player-auth/transfer"].POST(...init);
  }

  postApiPlayerAuthTransfer(
    ...init: Parameters<PathBasedClient<paths>["/api/player-auth/transfer"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerAuthTransferRaw(...init));
  }

  postApiPlayerInternalLoginTransferRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/login-transfer"]["POST"]>
  ) {
    return this.paths["/api/player-internal/login-transfer"].POST(...init);
  }

  postApiPlayerInternalLoginTransfer(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/login-transfer"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerInternalLoginTransferRaw(...init));
  }

  postApiPlayerInternalLogoutRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/logout"]["POST"]>
  ) {
    return this.paths["/api/player-internal/logout"].POST(...init);
  }

  postApiPlayerInternalLogout(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/logout"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerInternalLogoutRaw(...init));
  }

  postApiPlayerInternalMapAdmissionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/map-admission"]["POST"]>
  ) {
    return this.paths["/api/player-internal/map-admission"].POST(...init);
  }

  postApiPlayerInternalMapAdmission(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/map-admission"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerInternalMapAdmissionRaw(...init));
  }

  postApiPlayerInternalRuntimeIdentityRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/runtime-identity"]["POST"]>
  ) {
    return this.paths["/api/player-internal/runtime-identity"].POST(...init);
  }

  postApiPlayerInternalRuntimeIdentity(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/runtime-identity"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerInternalRuntimeIdentityRaw(...init));
  }

  postApiPlayerInternalScriptMetadataRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/script-metadata"]["POST"]>
  ) {
    return this.paths["/api/player-internal/script-metadata"].POST(...init);
  }

  postApiPlayerInternalScriptMetadata(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/script-metadata"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerInternalScriptMetadataRaw(...init));
  }

  postApiPlayerInternalScriptModerationRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/script-moderation"]["POST"]>
  ) {
    return this.paths["/api/player-internal/script-moderation"].POST(...init);
  }

  postApiPlayerInternalScriptModeration(
    ...init: Parameters<PathBasedClient<paths>["/api/player-internal/script-moderation"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayerInternalScriptModerationRaw(...init));
  }

  postApiPlayLogoutRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-logout"]["POST"]>
  ) {
    return this.paths["/api/play-logout"].POST(...init);
  }

  postApiPlayLogout(
    ...init: Parameters<PathBasedClient<paths>["/api/play-logout"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayLogoutRaw(...init));
  }

  postApiPlayPresenceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/play-presence"]["POST"]>
  ) {
    return this.paths["/api/play-presence"].POST(...init);
  }

  postApiPlayPresence(
    ...init: Parameters<PathBasedClient<paths>["/api/play-presence"]["POST"]>
  ) {
    return this.unwrap(this.postApiPlayPresenceRaw(...init));
  }

  postApiProjectModelsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/project-models"]["POST"]>
  ) {
    return this.paths["/api/project-models"].POST(...init);
  }

  postApiProjectModels(
    ...init: Parameters<PathBasedClient<paths>["/api/project-models"]["POST"]>
  ) {
    return this.unwrap(this.postApiProjectModelsRaw(...init));
  }

  postApiProjectScriptsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/project-scripts"]["POST"]>
  ) {
    return this.paths["/api/project-scripts"].POST(...init);
  }

  postApiProjectScripts(
    ...init: Parameters<PathBasedClient<paths>["/api/project-scripts"]["POST"]>
  ) {
    return this.unwrap(this.postApiProjectScriptsRaw(...init));
  }

  postApiProjectSkinsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/project-skins"]["POST"]>
  ) {
    return this.paths["/api/project-skins"].POST(...init);
  }

  postApiProjectSkins(
    ...init: Parameters<PathBasedClient<paths>["/api/project-skins"]["POST"]>
  ) {
    return this.unwrap(this.postApiProjectSkinsRaw(...init));
  }

  postApiRealtimeSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/realtime/session"]["POST"]>
  ) {
    return this.paths["/api/realtime/session"].POST(...init);
  }

  postApiRealtimeSession(
    ...init: Parameters<PathBasedClient<paths>["/api/realtime/session"]["POST"]>
  ) {
    return this.unwrap(this.postApiRealtimeSessionRaw(...init));
  }

  postApiRuntimeEnsureRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/runtime/ensure"]["POST"]>
  ) {
    return this.paths["/api/runtime/ensure"].POST(...init);
  }

  postApiRuntimeEnsure(
    ...init: Parameters<PathBasedClient<paths>["/api/runtime/ensure"]["POST"]>
  ) {
    return this.unwrap(this.postApiRuntimeEnsureRaw(...init));
  }

  postApiSystemBackupsRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/system/backups"]["POST"]>
  ) {
    return this.paths["/api/system/backups"].POST(...init);
  }

  postApiSystemBackups(
    ...init: Parameters<PathBasedClient<paths>["/api/system/backups"]["POST"]>
  ) {
    return this.unwrap(this.postApiSystemBackupsRaw(...init));
  }

  postBlockRaw(
    ...init: Parameters<PathBasedClient<paths>["/block"]["POST"]>
  ) {
    return this.paths["/block"].POST(...init);
  }

  postBlock(
    ...init: Parameters<PathBasedClient<paths>["/block"]["POST"]>
  ) {
    return this.unwrap(this.postBlockRaw(...init));
  }

  postBlockHashRaw(
    ...init: Parameters<PathBasedClient<paths>["/block/{hash}"]["POST"]>
  ) {
    return this.paths["/block/{hash}"].POST(...init);
  }

  postBlockHash(
    ...init: Parameters<PathBasedClient<paths>["/block/{hash}"]["POST"]>
  ) {
    return this.unwrap(this.postBlockHashRaw(...init));
  }

  postCreateSessionRaw(
    ...init: Parameters<PathBasedClient<paths>["/createSession"]["POST"]>
  ) {
    return this.paths["/createSession"].POST(...init);
  }

  postCreateSession(
    ...init: Parameters<PathBasedClient<paths>["/createSession"]["POST"]>
  ) {
    return this.unwrap(this.postCreateSessionRaw(...init));
  }

  postInternalSaveLocalProjectRaw(
    ...init: Parameters<PathBasedClient<paths>["/internal/save-local-project"]["POST"]>
  ) {
    return this.paths["/internal/save-local-project"].POST(...init);
  }

  postInternalSaveLocalProject(
    ...init: Parameters<PathBasedClient<paths>["/internal/save-local-project"]["POST"]>
  ) {
    return this.unwrap(this.postInternalSaveLocalProjectRaw(...init));
  }

  postLocalRuntimeDestroyRaw(
    ...init: Parameters<PathBasedClient<paths>["/__local_runtime/destroy"]["POST"]>
  ) {
    return this.paths["/__local_runtime/destroy"].POST(...init);
  }

  postLocalRuntimeDestroy(
    ...init: Parameters<PathBasedClient<paths>["/__local_runtime/destroy"]["POST"]>
  ) {
    return this.unwrap(this.postLocalRuntimeDestroyRaw(...init));
  }

  postLocalRuntimeStartRaw(
    ...init: Parameters<PathBasedClient<paths>["/__local_runtime/start"]["POST"]>
  ) {
    return this.paths["/__local_runtime/start"].POST(...init);
  }

  postLocalRuntimeStart(
    ...init: Parameters<PathBasedClient<paths>["/__local_runtime/start"]["POST"]>
  ) {
    return this.unwrap(this.postLocalRuntimeStartRaw(...init));
  }

  postRoomRoomIdLocalRuntimeDestroyRaw(
    ...init: Parameters<PathBasedClient<paths>["/__room/{roomId}/__local_runtime/destroy"]["POST"]>
  ) {
    return this.paths["/__room/{roomId}/__local_runtime/destroy"].POST(...init);
  }

  postRoomRoomIdLocalRuntimeDestroy(
    ...init: Parameters<PathBasedClient<paths>["/__room/{roomId}/__local_runtime/destroy"]["POST"]>
  ) {
    return this.unwrap(this.postRoomRoomIdLocalRuntimeDestroyRaw(...init));
  }

  putApiCreatorModelsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/{id}"]["PUT"]>
  ) {
    return this.paths["/api/creator-models/{id}"].PUT(...init);
  }

  putApiCreatorModelsId(
    ...init: Parameters<PathBasedClient<paths>["/api/creator-models/{id}"]["PUT"]>
  ) {
    return this.unwrap(this.putApiCreatorModelsIdRaw(...init));
  }

  putApiCreatorV1ProjectsProjectIdScriptsSideEntryRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}"]["PUT"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}"].PUT(...init);
  }

  putApiCreatorV1ProjectsProjectIdScriptsSideEntry(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/scripts/{side}/{entry}"]["PUT"]>
  ) {
    return this.unwrap(this.putApiCreatorV1ProjectsProjectIdScriptsSideEntryRaw(...init));
  }

  putApiCreatorV1ProjectsProjectIdStorageScopeSpaceRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"]["PUT"]>
  ) {
    return this.paths["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"].PUT(...init);
  }

  putApiCreatorV1ProjectsProjectIdStorageScopeSpace(
    ...init: Parameters<PathBasedClient<paths>["/api/creator/v1/projects/{projectId}/storage/{scope}/{space}"]["PUT"]>
  ) {
    return this.unwrap(this.putApiCreatorV1ProjectsProjectIdStorageScopeSpaceRaw(...init));
  }

  putApiLocalDefaultSkinRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/default-skin"]["PUT"]>
  ) {
    return this.paths["/api/local/default-skin"].PUT(...init);
  }

  putApiLocalDefaultSkin(
    ...init: Parameters<PathBasedClient<paths>["/api/local/default-skin"]["PUT"]>
  ) {
    return this.unwrap(this.putApiLocalDefaultSkinRaw(...init));
  }

  putApiLocalModelsIdRaw(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}"]["PUT"]>
  ) {
    return this.paths["/api/local/models/{id}"].PUT(...init);
  }

  putApiLocalModelsId(
    ...init: Parameters<PathBasedClient<paths>["/api/local/models/{id}"]["PUT"]>
  ) {
    return this.unwrap(this.putApiLocalModelsIdRaw(...init));
  }

}

export const createApiClient = (options: ApiClientOptions = {}) => new ApiClient(options);
