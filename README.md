# Map

Ayrıntılı bir harita uygulaması: katmanlar ve 3B arazi, askerî semboller,
yer arama ve içe aktarılan veriler. Ölçüm, uzunluk ve koordinat araçları
[`@omcoskun/convert-tools`](https://github.com/omcoskun/convert-tools)
kütüphanesinden gelir; uygulama bu hesapları kendisi yapmaz. React 18,
Webpack 5, MUI v5 ve MapLibre 6 ile yazılmıştır.

## Kurulum

Node.js 22.15 veya üstü ve npm gerekir.

Kütüphane GitHub Packages'tan gelir ve kurulum bir token ister. GitHub'da
`read:packages` yetkili bir classic kişisel erişim token'ı (PAT) oluşturun
ve `~/.npmrc` dosyanıza şu satırı, `ghp_X…` yerine kendi token'ınızı işaretsiz yazarak ekleyin:

```text
//npm.pkg.github.com/:_authToken=ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Repodaki `.npmrc`, `@omcoskun` paketlerinin nereden geleceğini söyler; token
içermez ve token hiçbir zaman repoya girmez. Ardından:

```bash
npm ci --ignore-scripts
npm run dev
```

Site `http://localhost:3008/` adresinde açılır. macOS'ta `Baslat.command`
çift tıklamayla paketleri kurar ve siteyi açar.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | geliştirme sunucusu, `http://localhost:3008/` |
| `npm run build` | üretim derlemesi (`build/`) |
| `npm test` | lang/config uyumu, render ve sınır kuralları testleri |
| `npm run lint` | ESLint 9 |

## Yayımlanmamış bir kütüphane değişikliğini denemek

Kütüphane reposunda paketi bir dosyaya paketleyin ve haritada o dosyayı
kurun. Bu değişikliği commit etmeyin; `package.json` ve kilit dosyası
yayımlanmış sürümü göstermeye devam etmelidir.

```bash
cd ../convert-tools/packages/core-js && npm pack --pack-destination /tmp
cd - && npm install /tmp/omcoskun-convert-tools-<sürüm>.tgz
```

Geri dönmek için `git checkout package.json package-lock.json && npm ci --ignore-scripts`.

## Doğruluk

JavaScript çekirdeğinde ölçülen en büyük farklar (Java aynı vektörleri geçer):

| Ne | Referans | En büyük fark |
|---|---|---:|
| UTM/UPS ileri ve ters | GeoConvert 2.7 | 4,8 nm |
| MGRS kodlama (birebir metin) / kare merkezi | GeoConvert 2.7 | 0 / 3,2 nm |
| EPSG:326xx, 327xx, 5041, 5042 | GeoConvert, PolarStereographic | 3,3 nm |
| EPSG:3857 | tanım formülü (Python) | 15 nm |
| Geodezik ters (mesafe) / doğrudan (konum) | GeodSolve 2.7 | 11,2 nm / 10,0 nm |
| GARS, GEOREF (birebir metin) / hücre merkezi | GeographicLib | 0 / 1,4e-14° |

Ölçümlerin ayrıntıları kütüphane reposundadır:
[omcoskun/convert-tools](https://github.com/omcoskun/convert-tools).

## Site

`npm run dev` ile `http://localhost:3008/` adresinde açılır. Site haritayla
açılır. Üst çubukta Harita ile üç sayfa aracı, haritanın solundaki araç
şeridinde harita araçları vardır; her araç kendi adresiyle açılır:

| Araç | Adres | Ne gösterir |
|---|---|---|
| Harita | `#map` | Araçsız harita; araç şeridi, yer arama, katmanlar, semboller ve veri |
| Ölçüm | `#measure` | İki nokta (ters problem), azimut + mesafe (düz problem) ve rota; WGS 84, GRS 80, küre veya özel (prolate dahil) model; bütün birimler ve jeodezik büyüklükler; neredeyse antipodal uçlarda azimut ve alan yalnız anlamlı basamaklarıyla (≈) ve belirsizliğiyle |
| Konum | `#positions` | DD, DMS, DDM, MGRS, UTM/UPS, GARS ve GEOREF arasında çeviri; çıktı hassasiyetleri ve MGRS karesinin köşesi veya merkezi |
| CRS | `#crs` | Desteklenen EPSG sistemleri arasında koordinat dönüşümü |
| Uzunluk | `#length` | Kesin kesirli oranlarla birim çevirisi, 0–60 ondalık hassasiyet, kesin kesir ve bütün birimler |
| Üç eksenli | `#triaxial` | Üç eksenli elipsoitte ters ve düz jeodezik problem, kartezyen dönüşümler |
| Referans | `#reference` | Doğruluk, WGS 84 sabitleri, desteklenen CRS'ler, birim tanımları ve hata kodları |

- **Çalışma alanı.** Ölçüm, Konum ve CRS tek bir haritanın üzerinde çalışır.
  Harita üst çubuğun altındaki bütün pencereyi kaplar. Soldaki araç şeridi
  bu üç aracı ve Sembol ile Veri panellerini açıp kapatır. Açık aracın
  girdileri şeridin yanındaki girdi panelinde, sonucu alttaki sonuç şeridinde
  durur. Panel daraltılır ya da kapatılır; kapalı aracın çizimi haritadan
  kalkar, açılınca olduğu gibi döner. Sembol ve Veri panelleri açık aracın
  panelinin yanına yerleşir (1180 px'ten dar pencerede onun üstüne), sonuç
  şeridi, ipuçları ve ölçek çubuğu bunların sağında kalır. Bir panel açılıp
  kapanınca harita ekranda yerinden oynamaz. "Ayrıntılar" düğmesi şeridin üstünde bir çekmece açar:
  bütün birimler, ek büyüklükler, model ve kütüphane çağrısı oradadır. Sağdaki
  denetimler yakınlaştırır, sonuca sığdırır, tüm dünyayı gösterir ve haritayı
  büyütür. 2D/3D seçici düz harita ile küre/perspektif arasında geçiş yapar;
  pusula kuzeye döndürüp eğimi sıfırlar. 3D görünümde sağ tuşla sürükleme
  eğim ve yönü değiştirir. Büyütülmüş haritada paneller gizlenir. Telefonda (760 px'in altı)
  açık aracın paneli ve şeridi ekranın altındaki bir sayfaya taşınır. Sayfanın tepesinde
  ana değeri gösteren koyu bir şerit vardır ve sayfa tutamaçla büyütülüp
  küçültülür.
- **Sayfa araçları.** Uzunluk, Üç eksenli ve Referans haritasız, ortalanmış
  birer sütundur ve sayfa kaydırılır. Çalışma alanı bu sırada gizli olarak
  açık kalır; geri dönüldüğünde harita aynı görünümdedir.
- **Araç durumu.** Araçlar arasında geçerken her araç girdilerini ve
  seçimlerini korur. Bu durum yalnız sayfa açıkken tutulur, kaydedilmez.
- **Araçlar arası aktarım.** Konum'daki nokta Ölçüm'e A veya B olarak ya da
  CRS'ye gönderilebilir; CRS'deki nokta Konum'a gönderilebilir.
- **Kütüphane çağrısı.** Her araç, sonucu üreten `@omcoskun/convert-tools`
  çağrısını kopyalanabilir biçimde gösterir.
- **Haritadan seçim ve yapıştırma.** Ölçüm'de A ve B haritadan seçilebilir ve
  sürüklenebilir; rotaya haritadan nokta eklenebilir. Konum ve CRS'de haritaya
  tıklamak noktayı seçer. Seçilen nokta ekran çözünürlüğüne (5–8 ondalık)
  yuvarlanıp forma yazılır. "41.0082, 28.9784" gibi bir çift, ya da DMS
  yazımı, nokta alanına yapıştırılabilir. Enlem ve boylam yer değiştirmişse
  düzeltilir ve bir notla bildirilir.
- **Sayılar.** Gösterilen değerler dile göre gruplanır (Türkçe `6.378.137` ve
  `0,3048`, İngilizce `6,378,137` ve `0.3048`). Kopyalanan değer her zaman
  düz yazılır: nokta ondalık ayırıcıdır ve basamak gruplaması yoktur.
  Koordinat çiftlerinde virgül iki değeri ayırdığı için çift her dilde ondalık
  noktayla yazılır.
- **Adresler.** `#<araç>` açık aracı belirtir. Adres bir araç belirtmiyorsa
  ilk açılışta araçsız harita (`#map`) açılır, sonradan değişirse açık araç
  olduğu gibi kalır.
  Eski `#distance` adresi Ölçüm'ü açar ve `#measure` olarak yeniden yazılır.
  `#reference/<bölüm>` Referans'ı o bölümde açar (`accuracy`, `wgs84`, `crs`,
  `units`, `errors`).

Değişmeyen kurallar:

- Bütün değerler `@omcoskun/convert-tools` kök girişinden gelir. Arayüzde hesap
  formülü yoktur; `test/boundaries.test.mjs` ve ESLint bunu denetler.
- `public/config.json` başlangıç değerlerini, örnekleri ve ön ayarları,
  `public/lang.json` Türkçe ve İngilizce metinleri ve hata kodlarının
  yerelleştirilmiş açıklamalarını tutar. İkisi açılışta okunur ve
  doğrulanır. Yayımlanmış bir derlemede yeniden derlemeden değiştirilebilirler.
  `test/lang.test.mjs` ve `config.test.mjs` anahtarların kodla ve
  çekirdekle uyumunu denetler. `render.test.mjs` her aracı iki dilde de
  çizer.
- `IWC` derleme değişkeni (`hap` veya `hwf`) webpack `DefinePlugin` ile
  `process.env.IWC` olarak gömülür ve `<html data-iwc>` olarak yazılır. İki
  değer arasındaki davranış farkı henüz tanımlı değildir; arayüz bu değere göre
  dallanmaz. Başka bir değer derlemeyi durdurur.

  ```bash
  IWC=hap npm run build
  ```

- `MAPTILER_KEY` derleme değişkeni uydu haritasının yakın görüntüsünü açar
  (aşağıya bakın). `DefinePlugin` ile `process.env.MAPTILER_KEY` olarak
  gömülür; boşsa ya da yoksa yakın görüntü olmaz, yerel geliştirme, testler ve
  CI anahtar istemez. Anahtar git'e girmez: GitHub Pages derlemesi onu
  `MAPTILER_KEY` adlı repo secret'ından alır. Anahtar MapTiler panelinde
  `omcoskun.github.io` ve `localhost` ile sınırlandırılır. Harf, rakam, `_`
  ve `-` dışında bir karakter derlemeyi durdurur (hata mesajı anahtarı
  yazmaz).

- Ekip standardı Emotion ve kurum içi bir MUI çatalıdır. Çatala
  erişilemediği için yerine `@mui/material` 5.18.0 kullanılır. Bütün MUI
  importları yalnız `src/ui/index.js` üzerinden geçer; çatala geçmek o
  dosyayı ve `package.json`'u değiştirmek demektir.
- Tarayıcı tabanı: arayüz için MUI v5'in desteklediği Chrome 90, Edge 91,
  Firefox 78, Safari 14 ve iOS 12.5; çekirdek tek başına Chrome 67,
  Firefox 68 ve Safari 14'te çalışır (BigInt).
- Üretim derlemesi göreli URL kullanır (GitHub Pages alt yolunda da çalışır)
  ve Content-Security-Policy meta etiketi taşır.
- Harita, MapLibre GL JS 6 ile çizilen bir vektör haritasıdır: uzaktan
  bakınca küre, yakınlaşınca (12. düzeyden sonra) Web Mercator; 2D modu
  her ölçekte düz Web Mercator kullanır. Kürenin arkasındaki uzay siyahtır;
  yıldızlar yerel bir canvas'ta iki küçük, kendini tekrarlayan desene bir kez
  çizilir ve kamera dönünce, kuzeye-güneye kayınca ya da eğilince kürenin
  çok gerisindeymiş gibi kayar (kare başına üç dolgu; sürekli animasyon veya
  ek görsel isteği yoktur, "hareketi azalt" ayarında yerinde durur). Küre
  ekranı kaplayınca yıldızlar gizlenir ve çizilmez.
  Kürenin kenarında atmosfer efekti bulunur.
  3D'de uzaklaşma sınırı ekranın panellerden kalan alanına ve enleme göre
  hesaplanır; küre bu alana sığdığında daha fazla uzaklaşılamaz. 2D'de düz
  dünya en az harita yüksekliği kadar kalır ve kuzey/güney kenarı ekranın
  dışında tutulur; uzay arka planı görünmez, dünya yanlara doğru tekrarlanır. Çekirdeğin
  örneklediği jeodezik hattı ve noktaları gösterir. Harita yalnız bir
  görseldir; ölçümü her zaman çekirdek yapar. Kutup yakınındaki noktalar ve
  kutbun üstünden geçen hatlar kürede gerçek yerlerinde çizilir (MapLibre'nin
  GeoJSON karoları ±85,05°'de bittiği için bu parça haritanın üstüne ayrıca
  çizilir). Kürede görünüm kutbun üstüne ortalanabilir ve 11. düzeye kadar
  yakınlaşılabilir; ±85,05°'nin ötesinde karo olmadığı için orası kenarın
  rengiyle düz boyanır. Antimeridyeni geçen hat tek parça çizilir.
- Üç altlık vardır ve `config.json` → `map.basemaps` içinde tanımlıdır
  (seçim hatırlanır): "standart" OpenFreeMap "positron"dur ve açık/koyu
  temayı izler (koyuda OpenFreeMap "dark" stili); "ayrıntılı" OpenFreeMap
  "liberty"dir (gölgeli rölyef ile); "uydu" EOX Sentinel-2 cloudless 2025
  görüntüsüdür (CC BY-NC-SA 4.0: yalnız ticari olmayan kullanım; bu site
  ticari değildir. 2017 katmanında Avrupa dışındaki karalar veri olmadığı
  için beyazdır, 2025 katmanı tüm karaları kapsar); altında NASA GIBS Blue
  Marble (kamu malı, en çok 8. düzey) kaba bir yedek olarak çizilir, böylece
  EOX karosu gelmediğinde boşluk yerine kaba görüntü görünür. Sınırlar ile
  yer adları vektör stilinden gelir; deniz ve okyanus adları mavi, kıta
  adları (`map.basemaps` → `continents`, adları `lang.json`) uzak
  görünümde aralıklı büyük harflerle yazılır. Uydu haritasında gecenin
  olduğu yarı, Güneş'in o anki konumuna göre (cihaz saati, 5 dakikada bir)
  karartılır ve NASA Black Marble şehir ışıklarıyla çizilir (`night`;
  kamu malı); bu katman 3. düzeyden sonra söner, 6. düzeyde hiç görünmez.
  Derlemede `MAPTILER_KEY` varsa 13. düzeyden itibaren EOX'un üstüne
  MapTiler'ın yakın uydu görüntüsü (`raster.detail`, ücretsiz plan, kart
  istemez, kota dolunca ay sonuna kadar durur, fatura çıkmaz) çizilir; bu
  sırada sağ altta MapTiler logosu görünür. MapTiler anahtarı ya da kotayı
  reddederse (401, 403, 429) yakın görüntü sayfa yenilenene kadar bırakılır ve
  EOX tek başına görünür; bu hiçbir zaman "bazı parçalar yüklenemedi" uyarısı
  çıkarmaz. Altlığın "bazı parçalar yüklenemedi" uyarısı, son 10
  saniyedeki karo yüklemelerinin en az dörtte biri (ve en az 3'ü) başarısız
  olunca çıkar; yakınlaştırırken iptal edilen istekler sayılmaz.
  Raster kaynaklar yalnız bu kataloğun girdileridir; `src/map/map-adapter.js`
  stildeki başka raster kaynakları atar. Altlık yüklenemezse harita istek
  yapmayan çevrimdışı bir ızgaraya döner ve "Yeniden dene" düğmesi
  gösterir; ölçüm ve seçim çalışmaya devam eder. OpenFreeMap ücretsizdir ama
  hizmet garantisi (SLA) vermez; gerekirse aynı stil kendi sunucunuzda
  barındırılabilir.
- Arazi (seçim hatırlanır): tepe gölgesi ve 3D arazi (varsayılan açık) ile
  yüksekliğe göre renkler (varsayılan kapalı; deniz tabanı boyanmaz). Üçü de
  `config.json` → `map.terrain` içindeki ücretsiz Terrarium yükseklik
  karolarını kullanır (AWS Open Data, anahtar ve hesap gerekmez; atfı Mapzen,
  USGS, EU-DEM ve diğerleri, tam liste bağlantının arkasında). Tepe gölgesi
  her altlıkta yolların, sınırların ve adların altına çizilir. 3D arazi
  yalnız küre (3D) görünümünde çalışır; yükseklik abartısı 1×, 1,5× veya 2×
  seçilir. 3D arazinin ağı bir düzey kaba (512 px) karolardan kurulur, dörtte
  bir karo yeter; tepe gölgesi 256 px karolarla aynı keskinlikte kalır. Açılınca harita gerekirse 3D görünüme geçer ve eğilir.
- Katmanlar: 3D binalar (varsayılan açık; küre görünümünde, yakınlaştırma
  14'ten itibaren, OpenFreeMap karolarındaki bina yüksekliklerinden),
  enlem/boylam ızgarası (aralığı yakınlaştırma düzeyini izler) ve MGRS ızgara
  bölgeleri (bu ikisi varsayılan kapalı).
- Askerî semboller (araç şeridindeki Sembol düğmesi): APP-6A, APP-6B,
  APP-6D, APP-6E, MIL-STD-2525C, 2525D ve 2525E standartlarında sembol
  paleti. Katalogda ad ya da kodla aranır ve kategoriye göre süzülür; kimlik,
  bağlam (gerçek/tatbikat/simülasyon), durum, kademe ya da hareket
  kabiliyeti, karargâh / görev kuvveti / aldatma göstergeleri, sektör
  niteleyicileri (sayısal standartlarda), 12 metin alanı ve boyut seçilir;
  SIDC önizlemenin altında yazar. Bir kutucuk ya da önizleme sürüklenip
  haritaya bırakılır, ya da "Haritaya yerleştir" (veya kutucuğa çift tıklama)
  ile haritaya tıklanan yere konur; konan sembol seçili kalmaz, palet yeni
  sembolde kalır. Sembol sürüklenerek taşınır, tıklanınca palette
  düzenlenir (değişiklik hemen uygulanır), Delete ile ya da paletten
  silinir. Semboller tarayıcıda hatırlanır (`localStorage`, en çok 500).
  Çizim sahibinin milsymbol çatalıyla yapılır (`github:omcoskun/milsymbol`,
  sabit commit, MIT); kütüphane ayrı bir parça olarak yalnız palet açılınca
  ya da haritada sembol varken yüklenir (`src/map/milsymbol.js`). Kataloglar
  `public/symbols/` altındadır ve çatalın `node scripts/build-studio.mjs
  --data DİZİN` çıktısından `node scripts/symbol-catalog.mjs DİZİN` ile
  üretilir; APP-6E kendi kataloğu olmadığı için 2525E'ninkini kullanır ve
  SIDC'si 16 sürümüyle yazılır.
- Veri ve görüntü (araç şeridindeki Veri düğmesi, ya da dosyaları
  haritaya bırakmak): GeoJSON, GPX (yol noktaları, rotalar, izler) ve KML
  (nokta, çizgi, delikli alan, MultiGeometry, gx:Track) dosyaları açılır;
  her dosya kendi renginde çizilir, gizlenir, ona yakınlaşılır ya da
  kaldırılır. Okuyucular projenin kendisinindir (`src/map/xml.js`,
  `src/map/geodata.js`); yalnız ad tutulur, yükseklik atılır. Dosya en çok
  25 MB ve 50.000 şekil olabilir; KMZ (sıkıştırılmış) açılmaz, önce KML'e
  çevrilmelidir. Bir görüntü (PNG, JPEG, WebP, GIF; en çok 40 MB, en uzun
  kenarı 4096 px'e küçültülür) görünümün boş kısmına konur ve dört köşesi
  ile ortadaki tutamaçtan sürüklenerek yerine oturtulur; opaklığı
  ayarlanır, altlığın adlarının ve çizilen çizgilerin altında kalır.
  MapLibre görüntüyü iki üçgenle çizdiği için köşeler dikdörtgenden çok
  saparsa köşegen boyunca kırılma görünür. Dosyalar tarayıcıda okunur,
  hiçbir yere gönderilmez ve saklanmaz: sayfa yenilenince kaybolur.
- Ölçek çubuğu Apple tarzıdır ve haritanın üst ortasında durur (telefonda
  sol üstte): yakınlaşırken görünür, sonra silinir; tıklayınca
  metrik, deniz mili ve imperial arasında döner; katman panelinden sabitlenebilir.
- Atıflar sağ altta bir ⓘ düğmesinin arkasındadır; altlık yüklendikten sonra
  5 saniye açık kalır, sonra kapanır (OSMF atıf yönergeleri buna izin verir).
  Atıflar `config.json`'da yapılandırılmış `{ text, href }` öğeleridir; uzak
  stilden HTML çizilmez. Liste yalnız o an haritada çizilen kaynakları
  sayar: bir atfın `minzoom`/`maxzoom` alanı kaynağının hangi düzeylerde
  çizildiğini söyler (Natural Earth 7'nin, NASA 8'in altında, MapTiler 13 ve
  üstünde); yükseklik karoları yalnız katmanları açıkken yazılır.
- Adres haritanın görünümünü taşır: `?map=yakınlaştırma/enlem/boylam`
  (döndürülmüş ya da eğik haritada `/yön/eğim` de eklenir;
  `src/map/view-link.js`). Harita durunca adres çubuğu güncellenir, araç
  bağlantıları (`#measure`, `#positions`, …) bunu korur ve böyle bir
  bağlantı açılınca harita sahneye sığdırılmadan o görünümde başlar.
  Kontrol sütunundaki zincir düğmesi bu bağlantıyı kopyalar. Tarayıcı izin
  veriyorsa (iPhone'da yoktur) bir düğme sayfayı tam ekrana alır. Site başka
  bir sayfanın çerçevesinde (iframe) açılınca tekerlek ve tek parmak o
  sayfayı kaydırır; harita Ctrl/⌘ ile tekerlekle, iki parmakla gezilir.
- Haritada sağ tık (dokunmatikte uzun basış) altlığın o noktada çizdiği
  adları (yer, cadde, su ya da park ve en küçük yerleşim; istek yapılmaz,
  `src/map/places.js`) ve noktayı ondalık derece ile MGRS olarak gösterir;
  koordinat ile MGRS tek tıkla kopyalanır. Noktanın yaklaşık
  yüksekliği de yazılır: 14. düzeydeki Terrarium karosunun tek pikselinden
  okunur (`src/map/elevation.js`); yalnız gösterimdir, hiçbir hesaba girmez. "Konumum" tarayıcının
  konum özelliğini kullanır ve jeodezik bir doğruluk çemberi çizer; konum
  uygulamanın sunucusuna gönderilmez.
- Açık, koyu ya da sistem teması üst çubuktan seçilir ve `localStorage`'da
  saklanır.
- CSP `connect-src` ve `img-src` (raster karolar resim olarak yüklenir),
  derleme sırasında `config.json` → `map` içindeki her adresin kaynağından
  kurulur (`webpack.config.js` → `mapOrigins`). Bu yüzden
  altlık sunucusunu değiştirmek, diğer ayarların aksine, yeniden derleme ister.
- MapLibre ayrı bir parça olarak, yalnız bir çalışma alanı aracı açıldığında
  yüklenir (`src/map/maplibre.js`). Araç bağlantısının üzerine gelinince ya da
  bağlantıya odaklanılınca önceden çekilir. Stil dosyası ve web worker
  `node_modules/maplibre-gl/dist`'ten olduğu gibi `vendor/` klasörüne
  kopyalanır. `loaders/blank-import-meta-url.cjs`, webpack'in
  kütüphanedeki `import.meta.url` ifadesine derleme makinesinin dosya yolunu
  gömmesini engeller.
- Harita WebGL2 ve modül web worker'ı ister (MapLibre 6). Bunlar olmayan
  tarayıcıda harita yerine bir açıklama çıkar; formlar ve sonuçlar yine
  çalışır.

## Güvenlik

[`SECURITY.md`](SECURITY.md)
