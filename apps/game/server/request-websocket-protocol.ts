type Request = {
  headers: Record<string, string | string[] | undefined>;
  socket: object;
};

/** Only accept proxy headers when the deployment explicitly trusts its proxy. */
export function requestWebSocketProtocol(req: Request, trustProxy: boolean): 'ws' | 'wss' {
  if ((req.socket as { encrypted?: boolean }).encrypted) return 'wss';
  const header = req.headers['x-forwarded-proto'];
  const first = (Array.isArray(header) ? header[0] : header)?.split(',')[0].trim().toLowerCase();
  return trustProxy && first === 'https' ? 'wss' : 'ws';
}
