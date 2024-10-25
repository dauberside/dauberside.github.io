import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"

const externalImages = [
  "https://i.pinimg.com/originals/63/18/6d/63186d8b8cee97e766f2dd7b49b8a35c.png",
  "https://i.pinimg.com/originals/67/74/44/67744483dc93a57ad7ca552cd4b919f5.png",
  "https://i.pinimg.com/originals/3e/ba/3b/3eba3b25bac88bc0c73dae32845397f6.png",
];

const Dauber = () => {
  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white ">
      <Header className="max-w-7xl mx-auto px-4" />
      <main className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 ">
          <div className="col-span-1 lg:col-span-2">
              <h1 className="text-2xl font-bold mb-4 pt-4">Dauber</h1>
              <div className="space-y-4 pb-4">
                <p>2004年スウェーデンの<a href="http://a5press.net/" className="text-blue-400 hover:underline">A5press</a>からKingsize DIY marker & globalization of Graffitiと題された書籍が発行された。これは私が知る限りDIYマーカーとその背景について記録された唯一の書籍である。</p>
                <p>DIYマーカーとは、グラフィティを行うライターたちが路上でタギング(サイン)の個性を競う経緯を経て制作されるようになったツールで、彼らは既存のペンやマーカーの改造、靴磨きや車用のポリッシャーのような別用途である製品の流用、自主制作等を行い、それぞれの自己流マーカーを作るという行為を行ってきた。</p>
                <p>イギリスから生まれ、1970年代に北米を中心に広がりを見せたDIYムーブメント(Do it Yourself運動)と時を同じくしてニューヨークで生まれたグラフィティにとってこうした流れはごく自然なことであった。だがこうした技術や資料は、グラフィティの広がるスピードとは反対に、匿名性やクルー(組織集団)というグラフィティがもつ性質によって、一部の共同体の中でしかシェアされることがなかったため、インターネットが普及する近年まで書籍や情報として全体に共有されることが非常に少なかったと言える。</p>
                <p>Kingsizeは、その書籍の名のごとく大きなマーカーを制作する一連の過程といくつかの論述で構成されている。当時としては見ることがなかったであろう50mmの太さのマーカーを、資材量販店で揃えたであろう素材を組み合わせて制作する過程と、そのマーカーを世界中のライターたちに配布、実用している記録写真。そしてkingsizeの発行者であり作家のアダムスの序文、ニューヨークで初期にグラフィティライターの青年たちへのインタビューを行い書籍[getting up]を著したクレイグ・キャッスルマンによる当時の情景描写、世界大戦後グローバリズムが進む中で世界中にアメリカナイゼーションが浸透していく様子と、その影響を受けるスウェーデン社会を捉えたアンドレアス・バーグの論述で構成されていた。</p>
                <p>先にも述べたように匿名性やクルーという性質を持つグラフィティカルチャーは、しばしばその細かな流れや背景等が、記録からもれ抜け落ちてしまうことが多い。そうした意味で世界のグローバリズムの中でグラフィティがニューヨークを経て世界中に広がっていく風景と、スウェーデンでの背景や流れを後世に残る形でドキュメントしていたこの書籍の役割は大きい。</p>
                <p>ではkingsizeが出版されてから16年が経過した今、ストリートで活動を続けるライターたちにとってのDIYマーカー、ツールどう変化したのだろうか。このプロジェクトでは、グラフィティにおけるツールの変容と表現の変容を考察するとともに、kingsizeを参照としながら、2010年代以降のメーカームーブメントの発展とともに可能となったデジタルファブリケーションの技術をもとに3Dソフトによるモデリングや、ソーシャルネットワーキングによる情報共有を試み、現代におけるDIYマーカーのあり方を探る。</p>
              </div>
          </div>
          <div className="col-span-1 md:col-span-2">
            <div className="text-white font-mono text-sm">
              <div className="grid grid-cols-6 gap-4 py-2 border-t border-gray-700 pb-2">
                <div className="px-4 col-span-2">Project</div>
                <div className="col-span-2">Program</div>
                <div className="col-span-2">Location</div>
              </div>
              <div className="grid grid-cols-6 gap-4 py-2 border-t border-b border-gray-700">
                <div className="px-4 col-span-2">Dauber</div>
                <div className="col-span-2">20200701</div>
                <div className="col-span-2">TOKYO</div>
              </div>
              <Accordion type="multiple" >
                <AccordionItem value="item-1" >
                  <AccordionTrigger className=" border-b border-gray-700">
                    <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-2">👀</div>
                      <div className="col-span-2">Φ50mm</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-6 gap-4 border-b border-gray-700">
                        <div className="px-4 col-span-2">Size</div>
                        <div className="col-span-2">Scale</div>
                        <div className="col-span-2">Date</div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                        <div className="px-4 col-span-2">"Φ50"</div>
                        <div className="col-span-2">1:1</div>
                        <div className="col-span-1">Blender</div>
                        <div className="col-span-1">
                        <Button size="sm" variant="ghost" className="w-full">Download</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                      <div className="col-span-2"></div>
                        <div className="col-span-2"></div>
                        <div className="col-span-1">STL</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">Download</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                      <div className="col-span-2"></div>
                      <div className="col-span-2"></div>
                        <div className="col-span-1">file</div>
                        <div className="col-span-">
                          <Button size="sm" variant="ghost" className="w-full">Download</Button>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" >
                  <AccordionTrigger className=" border-b border-gray-700">
                    <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-2">👀</div>
                      <div className="col-span-2">Φ80mm</div>
                      
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <div className="grid grid-cols-6 gap-4 border-b border-gray-700">
                        <div className="px-4 col-span-2">Size</div>
                        <div className="col-span-2">Scale</div>
                        <div className="col-span-2">Date</div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                        <div className="px-4 col-span-2">"Φ80"</div>
                        <div className="col-span-2">1:1</div>
                        <div className="col-span-1">Blender</div>
                        <div className="col-span-1">
                        <Button size="sm" variant="ghost" className="w-full">Download</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                      <div className="col-span-2"></div>
                        <div className="col-span-2"></div>
                        <div className="col-span-1">STL</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">Download</Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4 border-b border-gray-700">
                      <div className="col-span-2"></div>
                      <div className="col-span-2"></div>
                        <div className="col-span-1">file</div>
                        <div className="col-span-">
                          <Button size="sm" variant="ghost" className="w-full">Download</Button>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <section className="mt-8" aria-label="プロジェクト画像ギャラリー">
              <Carousel className="w-full mx-auto">
                <CarouselContent>
                  {externalImages.map((imageUrl, index) => (
                    <CarouselItem key={index}>
                      <div className="p-1">
                        <Image
                          src={imageUrl}
                          alt={`Dauber プロジェクト画像 ${index + 1}`}
                          width={1200}
                          height={800}
                          className="rounded-lg object-cover w-full h-auto"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </Carousel>
            </section>
          </div>
        </div>
      </main>
      <Footer className="max-w-7xl mx-auto px-4" />
    </div>
  )
}

export default Dauber