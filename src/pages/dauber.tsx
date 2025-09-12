import Image from "next/image";
import React, { useState } from "react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const externalImages = [
  "https://i.pinimg.com/originals/49/94/70/49947078c8a9373ad3794f870e48dc88.jpg",
];

const Dauber: React.FC = () => {
  const [language, setLanguage] = useState<"jp" | "en">("jp");

  const content = {
    jp: {
      title: "Dauber",
      description: [
        "2004年スウェーデンのA5pressからKingsize DIY marker & globalization of Graffitiと題された書籍が発行された。これは私が知る限りDIYマーカーとその背景について記録された唯一の書籍である。",
        "DIYマーカーとは、グラフィティを行うライターたちが路上でタギング(サイン)の個性を競う経緯を経て制作されるようになったツールで、彼らは既存のペンやマーカーの改造、靴磨きや車用のポリッシャーのような別用途である製品の流用、自主制作等を行い、それぞれの自己流マーカーを作るという行為を行ってきた。",
        "イギリスから生まれ、1970年代に北米を中心に広がりを見せたDIYムーブメント(Do it Yourself運動)と時を同じくしてニューヨークで生まれたグラフィティにとってこうした流れはごく自然なことであった。だがこうした技術や資料は、グラフィティの広がるスピードとは反対に、匿名性やクルー(組織集団)というグラフィティがもつ性質によって、一部の共同体の中でしかシェアされることがなかったため、インターネットが普及する近年まで書籍や情報として全体に共有されることが非常に少なかったと言える。",
        "Kingsizeは、その書籍の名のごとく大きなマーカーを制作する一連の過程といくつかの論述で構成されている。当時としては見ることがなかったであろう50mmの太さのマーカーを、資材量販店で揃えたであろう素材を組み合わせて制作する過程と、そのマーカーを世界中のライターたちに配布、実用している記録写真。そしてkingsizeの発行者であり作家のアダムスの序文、ニューヨークで初期にグラフィティライターの青年たちへのインタビューを行い書籍[getting up]を著したクレイグ・キャッスルマンによる当時の情景描写、世界大戦後グローバリズムが進む中で世界中にアメリカナイゼーションが浸透していく様子と、その影響を受けるスウェーデン社会を捉えたアンドレアス・バーグの論述で構成されていた。",
        "先にも述べたように匿名性やクルーという性質を持つグラフィティカルチャーは、しばしばその細かな流れや背景等が、記録からもれ抜け落ちてしまうことが多い。そうした意味で世界のグローバリズムの中でグラフィティがニューヨークを経て世界中に広がっていく風景と、スウェーデンでの背景や流れを後世に残る形でドキュメントしていたこの書籍の役割は大きい。",
        "ではkingsizeが出版されてから16年が経過した今、ストリートで活動を続けるライターたちにとってのDIYマーカー、ツールどう変化したのだろうか。このプロジェクトでは、グラフィティにおけるツールの変容と表現の変容を考察するとともに、kingsizeを参照としながら、2010年代以降のメーカームーブメントの発展とともに可能となったデジタルファブリケーションの技術をもとに3Dソフトによるモデリングや、ソーシャルネットワーキングによる情報共有を試み、現代におけるDIYマーカーのあり方を探る。",
      ],
    },
    en: {
      title: "Dauber",
      description: [
        "In 2004, A book entitled KING SIZE A project about Tags, DIY-Craft & Subcultural Globalization was published by A5press in Sweden. This is the only book I know about DIY markers and their background.",
        "DIY markers are tools that graffiti writers has come to create while competing for the individuality of tagging(signatures) on the street. They have modified existing pens and markers, diverted products for other purposes such as shoe polishers and for cars, etc. and made their own self made markers.",
        "This flow was quite natural for graffiti culture, which was born in New York at the same time as the DIY movement that was born in England and spread mainly in North America in the 1970s. However, contrary to the speed at which graffiti spreads these technologies and materials were spread only within some small communities due to the nature of graffiti such as anonymity and crew, so until the internet became widespread at recent years that it could be said that it was not a lot shared as a book or information.",
        "Kingsize consists of a series of processes and several essays that create a large marker, as the name of the book suggests. by combining materials that would have been prepared at a material mass retailer, the process of producing a marker with a thickness off 50mm, which would not have been seen at that time. recorded photos of distributing the marker to writers all over the world for practical use. the preface by publisher of King size and artist Adams. the scene description of the early days by Craig Cattleman who wrote the book getting up by interviewing young graffiti writers in New York. And Andreas Berg's essay on how Americanization pervades the world as globalism progresses after World War 2, and the Swedish society affected by it.",
        "as mentioned earlier, graffiti culture which has the characteristics of anonymity and crew, often loses its detailed flow and background from the records. in that sense, the role of this book which documented the landscape of graffiti spreading all over the world through New York while the globalism of the world, and the background and flow of Sweden in a way that will remain in posterity is significant.",
        "Now, 16 years ofter Kingsize was published, how have DIY makers and tools changed for writers who continue to writing on the street. In this project, we will consider the transformation of tools and expressions in graffiti, and while referring to kingsize, modeling with 3D software based on the digital fabrication technology that became possible with the development of the maker movement after the 2010s. And we will try to share information and file by social networking and explore the ideal way of DIY makers in modern times.",
      ],
    },
  };

  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white font-sans">
      <Header />
      <main className="w-full max-w-[1140px] mx-auto px-[50px] py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="col-span-1 lg:col-span-2">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">
                {content[language].title}
              </h1>
              <p className="text-sm mb-4">
                Language:
                <button
                  onClick={() => setLanguage("jp")}
                  className={`language-button ${language === "jp" ? "active" : ""}`}
                >
                  JP
                </button>
                /
                <button
                  onClick={() => setLanguage("en")}
                  className={`language-button ${language === "en" ? "active" : ""}`}
                >
                  EN
                </button>
              </p>
            </div>
            <div className="space-y-6 text-base leading-relaxed">
              {content[language].description.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
          {/* Right Column */}
          <div className="col-span-1 md:col-span-2">
            <div className="text-white font-mono text-sm">
              <div className="grid grid-cols-6 gap-4 py-2 border-t  border-gray-700 pb-2">
                <div className="px-2 col-span-2">Project</div>
                <div className="col-span-2">Program</div>
                <div className="col-span-2">Location</div>
              </div>
              <div className="grid grid-cols-6 gap-4 py-2 border-t border-b border-gray-700">
                <div className="px-2 col-span-2">Dauber</div>
                <div className="col-span-2">20200701</div>
                <div className="col-span-2">TOKYO</div>
              </div>
              {/* ... 他のコンテンツ ... */}
              <Accordion type="multiple">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="border-b border-gray-700">
                    <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-2">👀</div>
                      <div className="col-span-2">Φ50mm</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {/* AccordionContentの中身 */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-6 gap-4 py-2  border-b border-gray-700">
                        <div className="px-2 col-span-2">Size</div>
                        <div className="col-span-2">Scale</div>
                        <div className="col-span-2">Date</div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                        <div className="px-2 col-span-2">&quot;Φ50&quot;</div>
                        <div className="col-span-2">1:1</div>
                        <div className="col-span-1">Blender</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">
                            preparation
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                        <div className="col-span-2"></div>
                        <div className="col-span-2"></div>
                        <div className="col-span-1">STL</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">
                            preparation
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                        <div className="col-span-2"></div>
                        <div className="col-span-2"></div>
                        <div className="col-span-1">file</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">
                            preparation
                          </Button>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger className="border-b border-gray-700">
                    <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-2">👀</div>
                      <div className="col-span-2">Φ80mm</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {/* AccordionContentの中身 */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-6 gap-4 py-2  border-b border-gray-700">
                        <div className="px-2 col-span-2">Size</div>
                        <div className="col-span-2">Scale</div>
                        <div className="col-span-2">Date</div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                        <div className="px-2 col-span-2">&quot;Φ80&quot;</div>
                        <div className="col-span-2">1:1</div>
                        <div className="col-span-1">Blender</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">
                            preparation
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4  border-b border-gray-700">
                        <div className="col-span-2"></div>
                        <div className="col-span-2"></div>
                        <div className="col-span-1">STL</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">
                            preparation
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-4 border-b border-gray-700">
                        <div className="col-span-2"></div>
                        <div className="col-span-2"></div>
                        <div className="col-span-1">file</div>
                        <div className="col-span-1">
                          <Button size="sm" variant="ghost" className="w-full">
                            preparation
                          </Button>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            {/* ... 他のコンテンツ ... */}
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
  );
};

export default Dauber;
