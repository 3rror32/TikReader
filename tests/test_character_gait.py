"""Character gait regressions inspect extracted source pixels and rendered contacts."""
import importlib.util
from pathlib import Path
import numpy as np
import pytest

spec = importlib.util.spec_from_file_location('character_generator', Path(__file__).resolve().parents[1]/'tools/anatomical_buddies.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
CHARACTERS = {'chibis-2':2,'chibis-1':2,'goblins-4':2,'elfos-1':2,'cyborgs-1':2,'cyborgs-2':2,'cyborgs-6':4,'cyborgs-9':3,'monstruos-0':2}

@pytest.mark.parametrize('key,count', CHARACTERS.items())
def test_individual_chains_have_original_source_provenance_and_clear_old_feet(key,count):
    import character_buddies
    assert character_buddies.supports(key)
    source,kind,torso,limbs,legs,stance=generator.rig(key)
    assert len(limbs)==len(legs)==count
    assert len({limb['layer'].tobytes() for limb in limbs})==count
    assert len({tuple(limb['root']) for limb in limbs})==count
    union=np.logical_or.reduce([limb['mask']>0 for limb in limbs])
    pixels=np.array(source)
    assert np.array_equal(torso[~union],pixels[~union])
    assert not torso[union,3].any()
    for limb in limbs:
        mask=limb['mask']>0
        assert np.count_nonzero(limb['layer'][:,:,3])>=15
        assert np.array_equal(limb['layer'][mask],pixels[mask])
        for other in limbs:
            if other is not limb:assert np.count_nonzero(mask&(other['layer'][:,:,3]>0))<5

def test_tripod_is_three_beat_with_two_supports_not_a_quadruped(monkeypatch):
    assert generator.anatomy('cyborgs-9')=='tripod'
    monkeypatch.setattr(generator,'save_sprite',lambda *a:None)
    _,meta,trace=generator.build('cyborgs-9')
    assert meta['legs']==3 and meta['stance']==.75
    assert [(i,j) for i,f in enumerate(trace) for j,l in enumerate(f) if l['support'] and not trace[i-1][j]['support']]==[(0,0),(8,1),(16,2)]
    assert min(sum(l['support'] for l in f) for f in trace)==2
    assert max(sum(l['support'] for l in f) for f in trace)==3

@pytest.mark.parametrize('key', ['chibis-1','elfos-1'])
def test_robe_decoration_and_hem_stay_in_torso(key):
    import character_buddies
    source,_,torso,limbs,_,_=generator.rig(key)
    definition=character_buddies.config(key)
    left,top,right,bottom=definition['hem_region']
    shift=definition['source_shift']
    assert np.array_equal(torso[top+shift:bottom+shift,left:right],np.array(source)[top+shift:bottom+shift,left:right])
    assert all(limb['far'] for limb in limbs)

@pytest.mark.parametrize('key', CHARACTERS)
def test_rendered_contacts_reach_source_textured_feet_without_stretching(monkeypatch,key):
    monkeypatch.setattr(generator,'save_sprite',lambda *a:None)
    frames,meta,trace=generator.build(key)
    assert meta.get('rig')=='explicit-character-limbs'
    for index in range(meta['legs']):
        bones=[[np.linalg.norm(np.array(f[index][a])-f[index][b]) for a,b in [('root','knee'),('knee','foot')]] for f in trace]
        assert np.ptp(bones,axis=0).max()<.5
        contacts=0
        for image,f in zip(frames,trace):
            if f[index]['support']:
                x,y=np.rint(f[index]['paw']).astype(int)
                contacts+=np.count_nonzero(np.array(image)[max(0,y-5):min(128,y+5),max(0,x-6):min(128,x+7),3])>=8
        assert contacts>=8
        feet=np.array([f[index]['foot'] for f in trace])
        assert np.ptp(feet[:,0])>=5

@pytest.mark.parametrize('key,region',[
    ('chibis-2',(30,104,55)),('chibis-2',(67,106,91)),
    ('cyborgs-1',(37,101,62)),('cyborgs-1',(68,100,90)),
    ('cyborgs-2',(12,95,49)),('cyborgs-2',(68,93,109)),
    ('monstruos-0',(8,96,42)),('monstruos-0',(80,96,122)),
    ('goblins-4',(28,108,56)),('goblins-4',(60,108,85)),
])
def test_no_inspected_original_calf_or_boot_outline_is_stationary(key,region):
    left,top,right=region
    import character_buddies
    top+=character_buddies.config(key)['source_shift']
    assert not generator.rig(key)[2][top:,left:right,3].any()

@pytest.mark.parametrize('key',CHARACTERS)
def test_original_boot_collar_and_pad_are_rigid_pixel_translations(monkeypatch,key):
    import character_buddies
    original=character_buddies.warp_limb
    checked=[]
    def inspect(limb,root,knee,ankle,warp):
        import cv2
        layer=original(limb,root,knee,ankle,warp)
        foot=limb['layer'].copy()
        foot[:int(limb['foot'][1])]=0
        delta=np.rint(ankle-limb['foot'])
        translated=cv2.warpAffine(foot,np.float32([[1,0,delta[0]],[0,1,delta[1]]]),(128,128),flags=cv2.INTER_NEAREST)
        occupied=translated[:,:,3]>0
        assert np.array_equal(layer[occupied],translated[occupied])
        assert np.count_nonzero(occupied)==np.count_nonzero(foot[:,:,3])
        checked.append(True)
        return layer
    monkeypatch.setattr(character_buddies,'warp_limb',inspect)
    character_buddies.render(key,generator.mesh_warp,generator.solve_knee)
    assert len(checked)==24*CHARACTERS[key]

@pytest.mark.parametrize('key,region',[
    ('monstruos-0',(10,91,19,96)),('monstruos-0',(108,81,122,89)),
    ('cyborgs-2',(83,88,88,93)),('chibis-2',(33,103,39,104)),
])
def test_inspected_diagonal_upper_boot_outlines_follow_their_leg(key,region):
    left,top,right,bottom=region
    assert not generator.rig(key)[2][top:bottom,left:right,3].any()
