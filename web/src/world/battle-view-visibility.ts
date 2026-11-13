export function worldVisualVisibleInView(
  inBattleView:boolean,
  currentMapId:number,
  visualMapId:number,
):boolean{
  return !inBattleView&&currentMapId===visualMapId;
}

export function worldGuideLabelVisibleInView(
  inBattleView:boolean,
  worldVisualActorCount:number,
):boolean{
  return !inBattleView&&worldVisualActorCount===0;
}
