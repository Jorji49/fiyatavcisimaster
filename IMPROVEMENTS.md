# FiyatAvcısı Geliştirme Yol Haritası (V2)

Bu belge, projenin mevcut durumunu ve gelecekteki profesyonel gelişim adımlarını özetler.

## Mevcut Durum (Yapılan İyileştirmeler)

1.  **Mimari:** Proje, istemci tarafındaki statik yapıdan, Playwright tabanlı bir kazıyıcı (scraper) içeren Node.js/Express backend yapısına dönüştürüldü.
2.  **Veri Doğruluğu:** Önceki sürümlerdeki simüle edilmiş/rastgele fiyatlar kaldırıldı. Sistem artık Amazon ve Trendyol gibi mağazalardan **Canlı (Live)** veri çekmeye odaklıdır.
3.  **Performans:** Playwright tarayıcı örneği singleton olarak yapılandırıldı ve gereksiz kaynakların (fontlar, CSS vb.) yüklenmesi engellendi.
4.  **UI/UX:** Premium bir görünüm için skeleton loading, gelişmiş dark mode desteği ve modern kart tasarımları eklendi.
5.  **SEO & Paylaşım:** Dinamik meta etiketleri ve ürün bazlı paylaşım özellikleri eklendi.

## Kısa Vadeli Hedefler (3-6 Ay)

*   **Resmi API Entegrasyonları:** Kazıma (scraping) yönteminin kırılganlığını azaltmak için Amazon Associates, Trendyol Partner ve Hepsiburada API'lerine geçiş.
*   **Redis Caching:** Aynı aramaların tekrar tekrar kazınmasını önlemek için 1 saatlik sonuç önbellekleme.
*   **Kullanıcı Kayıt Sistemi:** Favori ürün takibi ve fiyat düştüğünde e-posta/push bildirimi gönderme.

## Orta Vadeli Hedefler (6-12 Ay)

*   **Fiyat Geçmişi Grafiği:** Bir ürünün son 30 günlük fiyat değişimini gösteren Chart.js entegrasyonu.
*   **Mobil Uygulama:** Mevcut PWA yapısını geliştirerek React Native veya Flutter ile yerel mobil uygulamalara geçiş.
*   **Yapay Zeka Destekli Filtreleme:** Kullanıcı yorumlarını analiz ederek ürünlere "Fiyat/Performans" puanı veren bir LLM katmanı.

## Teknik Borç ve Çözümler

*   **Büyük data.js dosyası:** Yazım yanlışı düzeltme için kullanılan 3700+ satırlık `data.js` dosyası, sunucu tarafında bir SQLite veya ElasticSearch indeksine taşınmalıdır.
*   **Bot Koruması:** Mağazaların bot korumalarını aşmak için döner proxy (rotating proxies) ve CAPTCHA çözücü servislerin entegrasyonu.
