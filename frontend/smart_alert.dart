import 'package:firebase_messaging/firebase_messaging.dart';

class SmartAlertService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  Future<void> initialize() async {
    // Bildirim izinlerini al
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('Bildirim izni onaylandı.');
    }
  }

  void handleDipPriceAlert(String productName, double price) {
    // Sadece fiyat dip yaptığında kullanıcıya bildirim gönder
    // Bu mantık backend'den gelen "is_dip_price" flag'i ile tetiklenir
    print('Akıllı Uyarı: $productName ürünü ₺$price ile tarihi dip seviyede!');
  }
}
