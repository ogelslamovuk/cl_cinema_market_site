"""One read-only poster query and one static catalog; no financial pipeline changes."""
from __future__ import annotations
import argparse, hashlib, io, json, os, pathlib, re, subprocess, sys, urllib.parse, urllib.request

LEGACY = 'catalog.eebcc30c5c833cec.json'
CATALOG = 'assets/posters/catalog.json'

def git(repo, *args, check=True):
    return subprocess.run(['git','-C',str(repo),*args],capture_output=True,check=check,timeout=40)

def previous(repo):
    path=repo/CATALOG
    if not path.exists():path=repo/'assets/posters'/LEGACY
    return json.loads(path.read_text(encoding='utf-8'))

def public_titles(repo):
    path=repo/'data/market-index.json';index=json.loads(path.read_text(encoding='utf-8'))
    day=(path.parent/index['days'][index['default_date']]['url']).resolve()
    if not day.is_relative_to(path.parent.resolve()):raise ValueError('Invalid day path')
    data=json.loads(day.read_text(encoding='utf-8'))
    return {row['film'] for row in data.get('silver_screen',{}).get('sessions',[])}

def read_database(config_path):
    import pymysql,yaml
    cfg=yaml.safe_load(config_path.read_text(encoding='utf-8'))['mysql']
    con=pymysql.connect(host=cfg['host'],port=int(cfg.get('port',3306)),user=cfg['user'],password=cfg['password'],database=cfg.get('database'),charset='utf8mb4',cursorclass=pymysql.cursors.DictCursor,connect_timeout=10,read_timeout=25,autocommit=False)
    try:
        with con.cursor() as cursor:
            cursor.execute('SET SESSION TRANSACTION READ ONLY')
            cursor.execute('SELECT e.id AS film_id,e.Name AS title,p.id AS media_id,p.Name AS url FROM cinema.events e LEFT JOIN cinema.eventsphoto p ON p.id=(SELECT x.id FROM cinema.eventsphoto x WHERE x.Event=e.id AND x.Type=1 AND x.Photo IS NOT NULL ORDER BY x.id DESC LIMIT 1) ORDER BY e.id LIMIT 20001')
            rows=cursor.fetchall()
            if len(rows)>=20001:raise ValueError('Poster metadata limit exceeded')
            return rows
    finally:con.rollback();con.close()

def build_catalog(rows,old,titles,repo,canonicalize=str.strip):
    old_by_id={item['film_id']:item for item in old['items']}
    wanted=set(titles)|{a for item in old['items'] for a in item['aliases']}
    items=[]
    for row in rows:
        if not isinstance(row.get('title'),str) or not row['title'].strip():continue
        fid,title=int(row['film_id']),row['title'].strip();prior=old_by_id.get(fid,{})
        aliases=set(prior.get('aliases',[]))|{title,canonicalize(title)}
        aliases=sorted(a for a in aliases if a in wanted)
        if not aliases:continue
        src=None
        try:
            url=urllib.parse.urlsplit(row['url'] or '')
            if url.scheme=='https' and url.hostname in {'rest.mooon.by','i.gyazo.com'} and not url.username and not url.password and not url.query and not url.fragment and url.port in {None,443}:src=row['url']
        except ValueError:pass
        asset=prior.get('asset') or prior.get('src')
        if row['media_id']==prior.get('media_id') and asset and re.fullmatch(r'f\d+-m\d+-[a-f0-9]{16}\.webp',asset) and (repo/'assets/posters'/asset).is_file():src=asset
        items.append({'film_id':fid,'title':title,'aliases':aliases,'media_id':row['media_id'],'src':src})
    seen={item['film_id'] for item in items}
    # Preserve verified historical aliases. Re-used names remain ambiguous in the client,
    # rather than silently switching an old report to another film's picture.
    for fid,prior in old_by_id.items():
        if fid not in seen:
            asset=prior.get('asset') or prior.get('src')
            items.append({'film_id':fid,'title':prior.get('title') or prior.get('canonical_title'),'aliases':prior['aliases'],'media_id':prior.get('media_id'),'src':asset})
    if not items:raise ValueError('Empty poster catalog')
    claims={}
    for item in [*old['items'],*items]:
        for alias in item['aliases']:claims.setdefault(alias,set()).add(item['film_id'])
    blocked=set(old.get('blocked_aliases',[]))|{name for name,ids in claims.items() if len(ids)>1}
    for item in items:
        item['aliases']=[name for name in item['aliases'] if name not in blocked]
        if not item['aliases']:item['src']=None
    return {'version':2,'source':'mooon-readonly-db','blocked_aliases':sorted(blocked),'items':sorted(items,key=lambda item:item['film_id'])}

def cache_images(data,old,repo):
    from PIL import Image,ImageOps
    prior={item['film_id']:item for item in old['items']}
    generated=[]
    for item in data['items']:
        if not (item['src'] or '').startswith('https:'):continue
        try:
            with urllib.request.urlopen(item['src'],timeout=12) as response:
                if not response.headers.get_content_type().startswith('image/'):raise ValueError('Invalid poster MIME')
                image_bytes=response.read(8_000_001)
            if len(image_bytes)>8_000_000:raise ValueError('Oversized poster')
            image=Image.open(io.BytesIO(image_bytes));image.load()
            if image.width<64 or image.height<64:raise ValueError('Invalid poster dimensions')
            image=ImageOps.pad(ImageOps.exif_transpose(image).convert('RGB'),(96,144),method=Image.Resampling.LANCZOS,color='#eef1f6')
            buffer=io.BytesIO();image.save(buffer,format='WEBP',quality=83,method=6)
            content=buffer.getvalue();digest=hashlib.sha256(content).hexdigest()
            name=f'f{item["film_id"]}-m{item["media_id"]}-{digest[:16]}.webp'
            (repo/'assets/posters'/name).write_bytes(content);item['src']=name;generated.append('assets/posters/'+name)
        except Exception:
            previous=prior.get(item['film_id'],{});asset=previous.get('asset') or previous.get('src')
            item['src']=asset if asset and '/' not in asset and (repo/'assets/posters'/asset).is_file() else None
            if item['src']:item['media_id']=previous.get('media_id')
    return generated

def prepare_worktree(repo,work):
    if work==repo or work.is_relative_to(repo):raise ValueError('Poster worktree must be separate')
    git(repo,'fetch','origin','main')
    if not work.exists():git(repo,'worktree','add','--detach',str(work),'origin/main')
    common=lambda path:git(path,'rev-parse','--git-common-dir').stdout.decode().strip()
    if (work/common(work)).resolve()!=(repo/common(repo)).resolve():raise ValueError('Unrelated poster worktree')
    # Recover only this job's derived metadata after interruption, never publisher files.
    for state in ['rebase-merge','rebase-apply']:
        state_path=pathlib.Path(git(work,'rev-parse','--git-path',state).stdout.decode().strip())
        if not state_path.is_absolute():state_path=work/state_path
        if state_path.exists():git(work,'rebase','--abort')
    temp=work/(CATALOG+'.tmp')
    if temp.exists():temp.unlink()
    dirty=git(work,'status','--porcelain').stdout.decode().splitlines()
    for line in dirty:
        path=line[3:]
        if path!=CATALOG and not re.fullmatch(r'assets/posters/f\d+-m\d+-[a-f0-9]{16}\.webp',path):raise ValueError('Unrelated poster worktree changes')
    for line in dirty:
        path=line[3:]
        if line[:2]=='??':(work/path).unlink()
        else:git(work,'restore','--staged','--worktree','--',path)
    git(work,'checkout','--detach','origin/main')

def refresh(args):
    repo=args.site_repo.resolve();work=args.worktree.resolve()
    if args.publish:prepare_worktree(repo,work);repo=work
    sys.path.insert(0,str(args.code_root))
    from src.film_catalog import canonical_film_title
    old=previous(repo)
    data=build_catalog(read_database(args.db_config),old,public_titles(repo),repo,canonical_film_title)
    generated=cache_images(data,old,repo)
    content=(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf-8')
    if not args.publish:
        args.output.write_bytes(content)
        return {'status':'prepared','films':len(data['items'])}
    target=repo/CATALOG
    if target.exists() and target.read_bytes()==content:return {'status':'unchanged','films':len(data['items'])}
    temp=repo/(CATALOG+'.tmp');temp.write_bytes(content);os.replace(temp,target)
    git(repo,'add','--',CATALOG,*generated);git(repo,'commit','-m','Refresh mooon poster catalog')
    for attempt in range(3):
        if git(repo,'push','origin','HEAD:main',check=False).returncode==0:
            return {'status':'published','films':len(data['items']),'commit':git(repo,'rev-parse','HEAD').stdout.decode().strip()}
        git(repo,'fetch','origin','main')
        if git(repo,'rebase','origin/main',check=False).returncode:
            git(repo,'rebase','--abort',check=False);raise RuntimeError('Poster update conflict; last published catalog retained')
    raise RuntimeError('Poster publication not confirmed')

def main():
    import fcntl
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-repo',type=pathlib.Path,required=True)
    parser.add_argument('--db-config',type=pathlib.Path,required=True)
    parser.add_argument('--worktree',type=pathlib.Path,default=pathlib.Path('/var/lib/cinema-market/runtime/posters/site'))
    parser.add_argument('--code-root',type=pathlib.Path,default=pathlib.Path('/opt/cinema-market-current'))
    parser.add_argument('--output',type=pathlib.Path)
    parser.add_argument('--publish',action='store_true')
    args=parser.parse_args()
    if not args.publish and not args.output:parser.error('--output required without --publish')
    try:
        lock_path=args.worktree.parent/'poster-refresh.lock';lock_path.parent.mkdir(parents=True,exist_ok=True)
        with lock_path.open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            print(json.dumps(refresh(args)))
    except Exception as error:
        # Never leak credential-bearing driver or Git transport diagnostics.
        print(json.dumps({'status':'failed','error':type(error).__name__}),file=sys.stderr);return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
