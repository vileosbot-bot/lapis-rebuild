#!/usr/bin/env python3
"""Generate synthetic assets for CI, never disguised as original game art."""
from pathlib import Path
import argparse,json,sys,hashlib
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools/convert'))
from spr import write_png


def _fill_span(pixels:bytearray,width:int,height:int,y:int,left:int,right:int,color:tuple[int,int,int,int]):
    if y<0 or y>=height:return
    left=max(0,left);right=min(width-1,right)
    if left>right:return
    row=bytes(color)*(right-left+1)
    start=(y*width+left)*4
    pixels[start:start+len(row)]=row


def _fill_rect(pixels:bytearray,width:int,height:int,left:int,top:int,right:int,bottom:int,color:tuple[int,int,int,int]):
    for y in range(top,bottom+1):_fill_span(pixels,width,height,y,left,right,color)


def _fill_diamond(pixels:bytearray,width:int,height:int,cx:int,cy:int,half_width:int,half_height:int,color:tuple[int,int,int,int]):
    for dy in range(-half_height,half_height+1):
        span=half_width*(half_height-abs(dy))//half_height
        _fill_span(pixels,width,height,cy+dy,cx-span,cx+span,color)


def _draw_line(pixels:bytearray,width:int,height:int,x0:int,y0:int,x1:int,y1:int,color:tuple[int,int,int,int],thickness:int=1):
    dx=abs(x1-x0);sx=1 if x0<x1 else -1
    dy=-abs(y1-y0);sy=1 if y0<y1 else -1
    error=dx+dy
    radius=max(0,thickness//2)
    while True:
        for oy in range(-radius,radius+1):_fill_span(pixels,width,height,y0+oy,x0-radius,x0+radius,color)
        if x0==x1 and y0==y1:break
        twice=2*error
        if twice>=dy:error+=dy;x0+=sx
        if twice<=dx:error+=dx;y0+=sy


def _draw_diamond_outline(pixels:bytearray,width:int,height:int,cx:int,cy:int,half_width:int,half_height:int,color:tuple[int,int,int,int]):
    points=((cx,cy-half_height),(cx+half_width,cy),(cx,cy+half_height),(cx-half_width,cy))
    for index in range(4):
        x0,y0=points[index];x1,y1=points[(index+1)%4]
        _draw_line(pixels,width,height,x0,y0,x1,y1,color)


def _draw_building(pixels:bytearray,width:int,height:int,cx:int,cy:int,roof:tuple[int,int,int,int],wall:tuple[int,int,int,int],detail:tuple[int,int,int,int]):
    _fill_rect(pixels,width,height,cx-12,cy-2,cx+12,cy+9,wall)
    _fill_diamond(pixels,width,height,cx,cy-4,18,7,roof)
    _draw_diamond_outline(pixels,width,height,cx,cy-4,18,7,detail)
    _fill_rect(pixels,width,height,cx-3,cy+3,cx+3,cy+9,detail)
    _fill_rect(pixels,width,height,cx-9,cy,cx-5,cy+3,(214,211,177,255))
    _fill_rect(pixels,width,height,cx+5,cy,cx+9,cy+3,(214,211,177,255))


def _add_diagonal_path(target:set[tuple[int,int]],start:tuple[int,int],end:tuple[int,int],walkable:set[tuple[int,int]]):
    dx=1 if end[0]>=start[0] else -1
    dy=1 if end[1]>=start[1] else -1
    steps=abs(end[0]-start[0])
    if steps!=abs(end[1]-start[1]):raise ValueError('Synthetic roads must follow the diagonal walkable lattice')
    for step in range(steps+1):
        cell=(start[0]+dx*step,start[1]+dy*step)
        if cell not in walkable:raise ValueError('Synthetic road leaves walkable collision cells: '+str(cell))
        target.add(cell)


def _plaza_cells(center:tuple[int,int],radius:int,walkable:set[tuple[int,int]])->set[tuple[int,int]]:
    cx,cy=center
    return {(x,y) for x in range(cx-radius,cx+radius+1) for y in range(cy-radius,cy+radius+1) if (x+y)%2==0 and (x,y) in walkable}


def _synthetic_map_pixels(map_id:int,width:int,height:int,cw:int,ch:int,grid:list[int],blocked_base:tuple[int,int,int,int])->bytes:
    pixels=bytearray(bytes(blocked_base)*(width*height))
    if map_id==0:
        walkable_palette=((73,128,75,255),(84,140,82,255),(66,116,70,255))
        road_palette=((178,139,82,255),(190,151,91,255),(168,129,76,255))
        plaza_palette=((166,160,119,255),(180,174,132,255),(153,151,116,255))
        road_segments=(((4,40),(42,2)),((22,22),(32,32)),((22,22),(12,12)))
        plaza_specs=(((22,22),2),((12,12),1),((32,32),1))
        buildings=((1,15),(45,31),(23,1),(23,45))
        roof_palette=((139,82,62,255),(112,91,66,255),(151,103,66,255),(117,75,60,255))
        wall_palette=((164,137,103,255),(146,127,99,255),(171,145,109,255),(151,128,99,255))
        accent=(43,61,51,255);road_edge=(104,79,53,255);road_highlight=(221,190,133,255)
        outline=(38,56,43,255);detail=(47,69,50,255)
    else:
        walkable_palette=((112,128,137,255),(125,140,147,255),(102,119,129,255))
        road_palette=((184,160,119,255),(198,175,132,255),(171,149,112,255))
        plaza_palette=((160,169,164,255),(177,183,173,255),(148,160,159,255))
        road_segments=(((8,36),(28,16)),((22,22),(12,12)),((22,22),(28,28)))
        plaza_specs=(((22,22),2),((12,12),1),((28,28),1))
        buildings=((1,13),(29,25),(15,1),(15,37))
        roof_palette=((139,83,69,255),(102,113,126,255),(151,105,77,255),(115,87,78,255))
        wall_palette=((164,151,132,255),(143,151,158,255),(174,158,134,255),(150,142,133,255))
        accent=(39,54,67,255);road_edge=(91,84,70,255);road_highlight=(226,205,157,255)
        outline=(37,48,59,255);detail=(48,62,73,255)
    blocked_palette=tuple((max(0,min(255,blocked_base[0]+delta)),max(0,min(255,blocked_base[1]+delta)),max(0,min(255,blocked_base[2]+delta)),255) for delta in (-5,5,0))
    walkable={(x,y) for x in range(cw) for y in range(ch) if grid[x*ch+y]==1}
    for x in range(cw):
        for y in range(ch):
            if (x+y)%2:continue
            value=grid[x*ch+y]
            tone=(x*7+y*11+map_id)%3
            color=walkable_palette[tone] if value==1 else blocked_palette[tone]
            cx=(x+1)*32;cy=(y+1)*16
            _fill_diamond(pixels,width,height,cx,cy,32,16,color)
    for x in range(cw):
        for y in range(ch):
            if (x+y)%2:continue
            cx=(x+1)*32;cy=(y+1)*16
            _draw_diamond_outline(pixels,width,height,cx,cy,32,16,outline)
    road_cells:set[tuple[int,int]]=set()
    for start,end in road_segments:_add_diagonal_path(road_cells,start,end,walkable)
    plaza_cells:set[tuple[int,int]]=set()
    for center,radius in plaza_specs:plaza_cells.update(_plaza_cells(center,radius,walkable))
    for x,y in sorted(road_cells-plaza_cells):
        tone=(x*3+y*5+map_id)%3;cx=(x+1)*32;cy=(y+1)*16
        _fill_diamond(pixels,width,height,cx,cy,32,16,road_palette[tone])
        _draw_diamond_outline(pixels,width,height,cx,cy,32,16,outline)
    for x,y in sorted(plaza_cells):
        tone=(x+y+map_id)%3;cx=(x+1)*32;cy=(y+1)*16
        _fill_diamond(pixels,width,height,cx,cy,32,16,plaza_palette[tone])
        _draw_diamond_outline(pixels,width,height,cx,cy,32,16,outline)
    for start,end in road_segments:
        x0=(start[0]+1)*32;y0=(start[1]+1)*16
        x1=(end[0]+1)*32;y1=(end[1]+1)*16
        _draw_line(pixels,width,height,x0,y0,x1,y1,road_edge,17)
        _draw_line(pixels,width,height,x0,y0,x1,y1,road_palette[1],11)
        _draw_line(pixels,width,height,x0,y0,x1,y1,road_highlight,3)
    for index,(x,y) in enumerate(buildings):
        if (x,y) in walkable:raise ValueError('Synthetic landmark building must occupy a blocked cell')
        cx=(x+1)*32;cy=(y+1)*16
        _draw_building(pixels,width,height,cx,cy,roof_palette[index],wall_palette[index],detail)
    for x,y in sorted(walkable-road_cells-plaza_cells):
        if (x*13+y*7+map_id*5)%19:continue
        cx=(x+1)*32;cy=(y+1)*16
        if map_id==0:
            _draw_line(pixels,width,height,cx-5,cy+2,cx-3,cy-2,(117,166,94,255))
            _draw_line(pixels,width,height,cx,cy+2,cx+2,cy-3,(117,166,94,255))
            _draw_line(pixels,width,height,cx+4,cy+2,cx+5,cy-1,(117,166,94,255))
        else:
            _fill_rect(pixels,width,height,cx-4,cy-1,cx+4,cy,(145,155,157,255))
    for index,(center,radius) in enumerate(plaza_specs):
        cx=(center[0]+1)*32;cy=(center[1]+1)*16
        if index==0:
            _draw_diamond_outline(pixels,width,height,cx,cy,18,9,accent)
            _draw_diamond_outline(pixels,width,height,cx,cy,12,6,road_highlight)
            _fill_rect(pixels,width,height,cx-2,cy-1,cx+2,cy+1,accent)
        else:
            _draw_diamond_outline(pixels,width,height,cx,cy,13,6,accent)
            _fill_rect(pixels,width,height,cx-3,cy-1,cx+3,cy+1,road_highlight)
            _fill_rect(pixels,width,height,cx-1,cy-3,cx+1,cy+3,accent)
    return bytes(pixels)


def map_payload(out:Path,map_id:int,name:str,width:int,height:int,cw:int,ch:int,color:tuple[int,int,int,int]):
    png=f'maps/map-{map_id:04d}.png';collision=f'maps/map-{map_id:04d}-collision.json';inspector=f'maps/map-{map_id:04d}-inspector.json'
    grid=[1 if (x+y)%2==0 and 1<x<cw-2 and 1<y<ch-2 else 0 for x in range(cw) for y in range(ch)]
    write_png(out/png,width,height,_synthetic_map_pixels(map_id,width,height,cw,ch,grid,color))
    (out/collision).write_text(json.dumps({'width':cw,'height':ch,'grid_order':'first-major','grid':grid}))
    mw=max(1,width//64);mh=max(1,height//32)
    (out/inspector).write_text(json.dumps({'width':mw,'height':mh,'cells':[{'resource_id':map_id+1,'directory_path':[0,0,0,0]}]*(mw*mh)}))
    return {'id':map_id,'name':name,'png':png,'collision':collision,'inspector':inspector,'render':{'width':width,'height':height},'evidence':'SYNTHETIC'}

def synthetic_content(out:Path)->dict:
    content=out/'content';quests=content/'quests';quests.mkdir(parents=True)
    npc={'schema':1,'source':'synthetic','npcs':[{'npc_id':11,'declared_entry_count':1,'name':'Synthetic Guide','entries':[{'line':2,'disabled':False,'record_type':1,'raw_numeric':[150,17,200,12],'text':'Synthetic source-backed NPC line.'}],'active_entry_count':1,'disabled_entry_count':0}],'comments':[],'summary':{'npc_count':1}}
    quest={'schema':1,'source':'synthetic','steps':[{'number':1,'events':[{'kind':'speaker','speaker':5000},{'kind':'line','command':'CANCEL','speaker':5000,'text':'Synthetic source-backed quest line.'}]}],'summary':{'step_count':1,'dialogue_line_count':1}}
    summary={'schema':1,'evidence':'SYNTHETIC','scope':'Synthetic content fixture; not original game text.','npc':{'npc_count':1,'active_entry_count':1,'disabled_entry_count':0},'quests':[{'source':'synthetic','step_count':1,'dialogue_line_count':1}]}
    tutorial={'schema':1,'source':'synthetic','talks':[{'talk_id':1,'line':1,'end_line':5,'events':[{'kind':'speaker','speaker':5000},{'kind':'text','text':'Synthetic tutorial text.'},{'kind':'control','command':'NEXT'}],'transition':{'kind':'Tutorial_NextStep'}}],'comments':[],'summary':{'talk_count':1,'talk_ids':[1],'text_line_count':1,'control_counts':{'NAME':1,'NEXT':1},'transition_counts':{'Tutorial_NextStep':1}}}
    help_script={'schema':1,'source':'synthetic','helps':[{'help_id':1,'line':1,'steps':[{'number':1,'line':2,'records':[[1,0,0,0]]}]}],'comments':[],'summary':{'help_count':1,'help_ids':[1],'step_count':1,'record_count':1,'comment_count':0}}
    tutorial_help_summary={'schema':1,'evidence':'SYNTHETIC','tutorial':{'talk_count':1,'talk_ids':[1],'text_line_count':1,'control_counts':{'NAME':1,'NEXT':1},'transition_counts':{'Tutorial_NextStep':1}},'help_script':{'help_count':1,'help_ids':[1],'step_count':1,'record_count':1,'comment_count':0}}
    (content/'summary.json').write_text(json.dumps(summary));(content/'npc-script.json').write_text(json.dumps(npc));(quests/'quest0.json').write_text(json.dumps(quest));(content/'tutorial.json').write_text(json.dumps(tutorial));(content/'help-script.json').write_text(json.dumps(help_script));(content/'tutorial-help-summary.json').write_text(json.dumps(tutorial_help_summary))
    return {'evidence':'SYNTHETIC','scope':'Synthetic content fixture; not original game text.','summary':'content/summary.json','npc_script':'content/npc-script.json','quests':{'0':'content/quests/quest0.json'},'tutorial':'content/tutorial.json','help_script':'content/help-script.json','tutorial_help_summary':'content/tutorial-help-summary.json'}

def generate(out:Path):
    if out.exists():raise FileExistsError('Refusing existing pack')
    out.mkdir(parents=True)
    maps={'0':map_payload(out,0,'Synthetic fixture',1536,768,47,47,(38,62,52,255)),'1':map_payload(out,1,'Synthetic city',1024,640,31,39,(49,54,68,255))}
    manifest={'schema':1,'provenance':{'kind':'synthetic','evidence':'VERIFIED'},'characters':{},'map':maps['0'],'maps':maps,'effects':{},'content':synthetic_content(out)}
    characters=[*( (cid,'swordsman',(205,185,110,255)) for cid in range(100,191,10) ),*( (cid,'wizard',(136,139,196,255)) for cid in range(109,200,10) )]
    for cid,label,color in characters:
        char={'class_id':cid,'label':label,'actions':{}}
        for action in ['00','01','02','03','05']:
            n=11 if cid==109 and action=='05' else 4
            rel=f'characters/B{cid}/{action}';bounds=[]
            for i in range(n*8):
                left=-12-i%2;bounds.append({'index':i,'left':left,'top':-42,'right':12,'bottom':2})
                write_png(out/f'{rel}/frames/frame-{i:03d}.png',12-left,44,bytes(color)*(12-left)*44)
            anim={'action_slot':action,'frames_per_direction':n,'raw_timing':5,'directions':[[d*n+j for j in range(n)] for d in range(8)],'spr_frame_count':n*8,'frame_bounds':bounds}
            (out/f'{rel}/animation.json').write_text(json.dumps(anim));char['actions'][action]={'animation':f'{rel}/animation.json','frames_dir':f'{rel}/frames'}
        manifest['characters'][str(cid)]=char
    effect_rel='effects/magic-001/frames';effect_bounds=[]
    for i,size in enumerate((24,30,36)):
        left=-size//2;top=-size//2;effect_bounds.append({'index':i,'left':left,'top':top,'right':left+size,'bottom':top+size})
        rgba=bytes((210,170+i*20,90,180))*(size*size);write_png(out/f'{effect_rel}/frame-{i:03d}.png',size,size,rgba)
    manifest['effects']['1']={'resource_id':1,'layer_name':'FOCUS','raw_timing':30,'frame_count':3,'sequence':[0,1,2],'frames_dir':effect_rel,'frame_bounds':effect_bounds,'sequence_evidence':'SYNTHETIC','timing_semantics':'UNVERIFIED','placement_semantics':'UNVERIFIED','warning':'Synthetic diagnostic effect'}
    (out/'prototype.json').write_text(json.dumps(manifest))
    files={p.relative_to(out).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size} for p in sorted(out.rglob('*')) if p.is_file()}
    (out/'asset-index.json').write_text(json.dumps({'schema':1,'files':files},indent=2))
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();generate(a.out)
