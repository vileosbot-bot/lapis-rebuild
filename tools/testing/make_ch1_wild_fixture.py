#!/usr/bin/env python3
"""Build a synthetic Chapter 1 pack for M7.3 browser tests only; never original game art."""
from __future__ import annotations

import argparse
import binascii
import copy
import hashlib
import json
import struct
import sys
import zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/testing'))
from make_web_fixture import generate as generate_base


def png_chunk(kind:bytes,payload:bytes)->bytes:
    return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',binascii.crc32(kind+payload)&0xffffffff)


def write_solid_png(path:Path,width:int,height:int,color:tuple[int,int,int,int])->None:
    path.parent.mkdir(parents=True,exist_ok=True)
    row=b'\x00'+bytes(color)*width
    compressor=zlib.compressobj(6)
    chunks=[]
    for _ in range(height):
        block=compressor.compress(row)
        if block:chunks.append(block)
    tail=compressor.flush()
    if tail:chunks.append(tail)
    payload=b''.join(chunks)
    with path.open('wb') as handle:
        handle.write(b'\x89PNG\r\n\x1a\n')
        handle.write(png_chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0)))
        handle.write(png_chunk(b'IDAT',payload))
        handle.write(png_chunk(b'IEND',b''))


def add_line(cells:set[tuple[int,int]],start:tuple[int,int],end:tuple[int,int])->None:
    x,y=start;tx,ty=end
    while (x,y)!=(tx,ty):
        cells.add((x,y))
        if x<tx:x+=1
        elif x>tx:x-=1
        elif y<ty:y+=1
        elif y>ty:y-=1
    cells.add((tx,ty))


def map1020_walkable_cells()->set[tuple[int,int]]:
    cells:set[tuple[int,int]]=set()
    # Test-only route-048 corridor. It deliberately crosses 22022 and 22023
    # while routeLength remains non-zero; this is not a retail map reconstruction.
    add_line(cells,(3,173),(3,172))
    add_line(cells,(3,172),(38,172))
    add_line(cells,(38,172),(38,140))
    cells.add((37,139))
    add_line(cells,(37,139),(36,138))
    add_line(cells,(36,138),(55,138))
    add_line(cells,(55,138),(55,131))
    cells.add((54,130))
    cells.add((53,129))
    add_line(cells,(53,129),(64,129))
    add_line(cells,(64,129),(64,14))
    add_line(cells,(64,14),(67,13))

    # Test-only return corridor from route-049 arrival to 22024's approach cell.
    # It avoids every route-048 activation cell.
    add_line(cells,(66,4),(65,4))
    add_line(cells,(65,4),(64,4))
    add_line(cells,(64,4),(64,120))
    add_line(cells,(64,120),(48,120))

    # All six recovered placement and approach cells are present in the fixture.
    cells.update({
        (4,144),(3,143),
        (12,142),(11,141),
        (37,153),(36,152),
        (37,139),(36,138),
        (54,130),(53,129),
        (49,121),(48,120),
    })

    # Owner-approved route activation cells. Declared approach anchors may be blocked.
    route041=[
        (2,176),(2,178),(3,175),(3,177),(3,179),(4,173),(4,174),(4,176),
        (4,178),(4,180),(4,182),(5,175),(5,177),(5,179),(6,176),(6,178),(7,177),
    ]
    cells.update(cell for cell in route041 if cell not in {(4,173),(4,182)})
    route048=[
        (65,7),(65,9),(66,6),(66,8),(66,10),(67,4),(67,5),(67,7),(67,9),
        (67,11),(67,13),(68,6),(68,8),(68,10),(68,13),(69,7),(69,9),(70,8),
    ]
    cells.update(cell for cell in route048 if cell not in {(67,4),(67,13),(68,13)})
    cells.update({(3,173),(66,4)})
    return cells


def map_asset(out:Path,map_id:int,name:str,grid_width:int,grid_height:int,walkable:set[tuple[int,int]])->dict:
    render_width=grid_width*32
    render_height=grid_height*16
    png=f'maps/map-{map_id:04d}.png'
    collision=f'maps/map-{map_id:04d}-collision.json'
    inspector=f'maps/map-{map_id:04d}-inspector.json'
    color={
        1000:(39,65,48,255),
        1020:(48,73,53,255),
        1030:(59,58,76,255),
        1060:(54,62,70,255),
    }.get(map_id,(44,54,50,255))
    write_solid_png(out/png,render_width,render_height,color)
    grid=[1 if (x,y) in walkable else 0 for x in range(grid_width) for y in range(grid_height)]
    (out/collision).write_text(json.dumps({
        'width':grid_width,'height':grid_height,'grid_order':'first-major','grid':grid,
    },separators=(',',':')))
    mw=max(1,render_width//64);mh=max(1,render_height//32)
    (out/inspector).write_text(json.dumps({
        'width':mw,'height':mh,
        'cells':[{'resource_id':map_id+1,'directory_path':[0,0,0,0]}]*(mw*mh),
    },separators=(',',':')))
    return {
        'id':map_id,'name':name,'png':png,'collision':collision,'inspector':inspector,
        'render':{'width':render_width,'height':render_height},
        'evidence':'SYNTHETIC','runtimeVerified':False,
    }


def generate(out:Path)->None:
    generate_base(out)
    manifest_path=out/'prototype.json'
    manifest=json.loads(manifest_path.read_text())
    manifest['provenance']={'kind':'synthetic','evidence':'SYNTHETIC','runtimeVerified':False}
    map_specs=[
        (1000,'Synthetic Chapter 1 map 1000',159,319),
        (1020,'Synthetic Chapter 1 map 1020',199,399),
        (1030,'Synthetic Chapter 1 map 1030',89,149),
        (1060,'Synthetic Chapter 1 map 1060',149,149),
    ]
    for map_id,name,width,height in map_specs:
        cells:set[tuple[int,int]]=set()
        if map_id==1000:
            add_line(cells,(93,5),(139,5))
            route040=[
                (79,6),(139,5),(139,7),(140,4),(140,6),(140,8),(141,3),(141,5),
                (141,7),(141,9),(142,4),(142,6),(142,8),(143,5),(143,7),(144,6),
            ]
            cells.update(cell for cell in route040 if cell!=(79,6))
        elif map_id==1020:
            cells=map1020_walkable_cells()
        elif map_id==1030:
            cells.add((5,137))
            route049=[
                (4,140),(4,142),(5,139),(5,141),(5,143),(6,137),(6,138),(6,140),
                (6,142),(6,144),(7,139),(7,141),(7,143),(7,144),(8,140),(8,142),(9,141),
            ]
            cells.update(cell for cell in route049 if cell!=(6,137))
            cells.update({
                (71,27),(73,27),(70,28),(72,28),(74,28),(71,29),(73,29),(72,30),
            })
        else:
            cells.add((20,120))
        manifest['maps'][str(map_id)]=map_asset(out,map_id,name,width,height,cells)

    # B4524 is a synthetic visual proxy used only to satisfy the existing
    # Chapter 1 NPC bootstrap in browser tests. It is not an original binding.
    proxy=copy.deepcopy(manifest['characters']['100'])
    proxy['class_id']=4524
    proxy['label']='synthetic Chapter 1 NPC proxy'
    manifest['visuals']={'4524':proxy}
    manifest_path.write_text(json.dumps(manifest,separators=(',',':')))

    files={
        p.relative_to(out).as_posix():{
            'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
            'size':p.stat().st_size,
        }
        for p in sorted(out.rglob('*')) if p.is_file() and p.name!='asset-index.json'
    }
    (out/'asset-index.json').write_text(json.dumps({
        'schema':1,'evidence':'SYNTHETIC','fixture':'m7.3-ch1-wild','files':files,
    },indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    generate(args.out)
