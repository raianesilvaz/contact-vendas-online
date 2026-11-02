import random
from shapely.geometry import shape,Polygon,MultiPolygon,Point,mapping
from shapely import make_valid
from shapely.ops import unary_union

def polygon_parts(geometry):
    if geometry.geom_type=='Polygon':return [geometry] if geometry.area>0 else []
    if hasattr(geometry,'geoms'):return [p for g in geometry.geoms for p in polygon_parts(g)]
    return []

def ring_inside(point,ring):
    x,y=point;answer=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:answer=not answer
    return answer

def source_inside(point,rings):
    return ring_inside(point,rings[0]) and not any(ring_inside(point,r) for r in rings[1:])

def normalize_area(obj):
    """Preserve valid areas; repair linework parity without buffering or closing open lines."""
    source=shape(obj)
    if source.geom_type=='LineString':
        coords=list(source.coords)
        if not source.is_closed or len(coords)<4:return obj,False,'open_line'
        rings=[[list(p) for p in coords]];source=Polygon(coords)
    elif source.geom_type=='Polygon':rings=obj['coordinates']
    elif source.geom_type=='MultiPolygon':
        return obj,source.is_valid and not source.is_empty,'valid_multipolygon'
    else:return obj,False,'unsupported'
    if source.is_valid and not source.is_empty and source.area>0:
        return mapping(source),True,'closed_line' if obj['type']=='LineString' else 'valid_polygon'
    outer=polygon_parts(make_valid(Polygon(rings[0])))
    if not outer:return obj,False,'no_area'
    result=unary_union(outer)
    holes=[p for ring in rings[1:] for p in polygon_parts(make_valid(Polygon(ring)))]
    if holes:result=result.difference(unary_union(holes))
    parts=polygon_parts(result)
    if not parts:return obj,False,'no_area'
    result=parts[0] if len(parts)==1 else MultiPolygon(parts)
    if not result.is_valid or result.is_empty:return obj,False,'unresolved'
    # Repair cannot create area beyond the original exterior bounds.
    box=Polygon(rings[0]).bounds
    if any(result.bounds[i]<box[i]-1e-10 for i in (0,1)) or any(result.bounds[i]>box[i]+1e-10 for i in (2,3)):
        return obj,False,'expanded_bounds'
    rng=random.Random(20261102)
    samples=[(rng.uniform(box[0],box[2]),rng.uniform(box[1],box[3])) for _ in range(200)]
    samples += [(p.representative_point().x,p.representative_point().y) for p in parts]
    for xy in samples:
        if source_inside(xy,rings)!=result.contains(Point(xy)):return obj,False,'parity_mismatch'
    return mapping(result),True,'repaired'
