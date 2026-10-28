"""Prepare explicitly reviewed calendar readings before a narration model runs."""
from pathlib import Path
import argparse,hashlib,json
from spoken_years import normalize_calendar_years

def sha(raw):return hashlib.sha256(raw).hexdigest()
def prepare(source,selection):
 raw=source.read_bytes();text=raw.decode('utf-8')
 if sha(raw)!=selection['source_sha256']:raise ValueError('Reviewed calendar selection belongs to a different source file')
 spoken,entries=normalize_calendar_years(text,selection['spans'])
 return spoken,dict(schema='reviewed-calendar-input-v1',source_sha256=sha(raw),spoken_input_sha256=sha(spoken.encode()),normalizer_sha256=sha(Path(__file__).with_name('spoken_years.py').read_bytes()),reviewed_calendar_years=entries,all_other_source_characters_preserved=True)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('selection',type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--receipt',required=True,type=Path);a=p.parse_args()
 if a.output.resolve()==a.receipt.resolve() or {a.source.resolve(),a.selection.resolve()} & {a.output.resolve(),a.receipt.resolve()}:raise ValueError('Keep distinct outputs and preserve the original prose and reviewed selection')
 spoken,receipt=prepare(a.source,json.loads(a.selection.read_text()));a.output.write_text(spoken);a.receipt.write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n');print(json.dumps(dict(reviewed_calendar_years=len(receipt['reviewed_calendar_years']),spoken_input_sha256=receipt['spoken_input_sha256'])))
if __name__=='__main__':main()
