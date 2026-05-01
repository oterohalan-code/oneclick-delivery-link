// Push notifications: feature deshabilitada por ahora.
// Se mantiene el export para no romper imports existentes.
export async function enablePush(_userId: string): Promise<boolean> {
  return false;
}
