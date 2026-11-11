export type M4RuntimeMode='default'|'chapter1';

export function m4RuntimeModeFromSearch(search:string):M4RuntimeMode{
  const params=new URLSearchParams(search);
  return params.get('m4')==='1'&&params.get('ch1')==='1'?'chapter1':'default';
}
