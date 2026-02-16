import 'package:flutter/material.dart';

class ShoppingDashboard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Fiyat Avcısı: Alışveriş Paneli'),
        backgroundColor: Colors.blueAccent,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildSavingsCard(),
            _buildAutopilotEntry(context),
            _buildPersonalOffers(),
            _buildPriceAlerts(),
          ],
        ),
      ),
    );
  }

  Widget _buildSavingsCard() {
    return Card(
      margin: EdgeInsets.all(16),
      child: ListTile(
        leading: Icon(Icons.account_balance_wallet, color: Colors.green),
        title: Text('Toplam Tasarruf'),
        subtitle: Text('₺1,250.00 bu ay'),
        trailing: Icon(Icons.trending_up, color: Colors.green),
      ),
    );
  }

  Widget _buildPersonalOffers() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('Senin İçin Fırsatlar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ),
        Container(
          height: 150,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _offerItem('iPhone 16 Pro', '%15 İndirim'),
              _offerItem('Sony WH-1000XM5', 'Dip Fiyat!'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _offerItem(String name, String badge) {
    return Container(
      width: 140,
      margin: EdgeInsets.all(8),
      color: Colors.blue.shade50,
      child: Center(child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(name, textAlign: TextAlign.center),
          Chip(label: Text(badge, style: TextStyle(fontSize: 10))),
        ],
      )),
    );
  }

  Widget _buildAutopilotEntry(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.blue.shade800,
      child: ListTile(
        leading: Icon(Icons.auto_awesome, color: Colors.white),
        title: Text('Otopilot Asistanı', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        subtitle: Text('Bütçeni AI ile optimize et', style: TextStyle(color: Colors.white70)),
        trailing: Icon(Icons.chevron_right, color: Colors.white),
        onTap: () {
          // Navigate to AutopilotView
        },
      ),
    );
  }

  Widget _buildPriceAlerts() {
    return ListTile(
      title: Text('Aktif Takipteki Ürünler'),
      trailing: Badge(label: Text('3')),
    );
  }
}
