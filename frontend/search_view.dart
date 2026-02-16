import 'package:flutter/material.dart';
import 'product_card.dart';

class SearchView extends StatefulWidget {
  @override
  _SearchViewState createState() => _SearchViewState();
}

class _SearchViewState extends State<SearchView> {
  final TextEditingController _queryController = TextEditingController();
  List<dynamic> _results = [];
  bool _isLoading = false;

  void _search() async {
    setState(() { _isLoading = true; });
    // Simulate API call to FastAPI backend /search
    await Future.delayed(Duration(seconds: 1));
    setState(() {
      _isLoading = false;
      _results = [
        {"name": "MacBook Air M3", "price": 45000.0, "store": "Teknofest Store", "score": 0.94, "forecast": "-2.0%"},
        {"name": "iPhone 16 Pro", "price": 75000.0, "store": "Apple Store", "score": 0.88, "forecast": "+1.5%", "isOfficial": true},
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Fiyat Avcısı Arama')),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(16.0),
            child: TextField(
              controller: _queryController,
              decoration: InputDecoration(
                hintText: 'Ürün, Marka veya Model ara...',
                suffixIcon: IconButton(icon: Icon(Icons.search), onPressed: _search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(30)),
              ),
            ),
          ),
          if (_isLoading) CircularProgressIndicator(),
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.all(16),
              itemCount: _results.length,
              itemBuilder: (context, index) {
                final r = _results[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: ProductCard(
                    name: r['name'],
                    price: r['price'],
                    store: r['store'],
                    score: r['score'],
                    forecast: r['forecast'],
                    isOfficial: r['isOfficial'] ?? false,
                  ),
                );
              },
            ),
          )
        ],
      ),
    );
  }
}
