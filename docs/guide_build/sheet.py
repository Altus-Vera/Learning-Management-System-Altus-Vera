import os,sys
from PIL import Image, ImageDraw
fs=sorted(f for f in os.listdir('shots') if f.endswith('.png'))
per=20; W,H=360,225
for k in range(0,len(fs),per):
    sh=Image.new('RGB',(W*4,(H+16)*5),'white'); d=ImageDraw.Draw(sh)
    for i,f in enumerate(fs[k:k+per]):
        im=Image.open('shots/'+f).convert('RGB').resize((W,H)); x,y=(i%4)*W,(i//4)*(H+16)
        sh.paste(im,(x,y+16)); d.text((x+4,y+2),f,fill='red')
    sh.save(f'sheet{k//per}.png')
