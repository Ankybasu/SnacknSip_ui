
import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import {
  ApiService,
  MenuItem,
  CartLine,
  SalesSummary
} from './core/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    CurrencyPipe
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  menu = signal<MenuItem[]>([]);
  orders = signal<any[]>([]);
  summary = signal<SalesSummary | null>(null);
  cart = signal<CartLine[]>([]);

  customerName = '';
  customerPhone = '';

  // Search
  search = signal('');

  // Loading and error states
  saving = signal(false);
  error = signal('');
  lastBill = signal<any>(null);

  // Track which order is being deleted
  deletingOrderId = signal<string | null>(null);

  // Filter menu by name or category
  filteredMenu = computed(() => {
    const query = this.search().trim().toLowerCase();

    if (!query) {
      return this.menu();
    }

    return this.menu().filter(item =>
      (item.name + ' ' + item.category)
        .toLowerCase()
        .includes(query)
    );
  });

  // Calculate cart total
  total = computed(() =>
    this.cart().reduce(
      (sum, line) => sum + line.item.price * line.quantity,
      0
    )
  );

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  // Load menu, sales summary and order history
  load(): void {

    this.error.set('');

    this.api.menu().subscribe({
      next: data => this.menu.set(data),
      error: () => {
        this.error.set(
          'Could not load menu. Check API connection.'
        );
      }
    });

    this.api.summary().subscribe({
      next: data => this.summary.set(data),
      error: () => {
        this.error.set('Could not load sales summary.');
      }
    });

    this.api.orders().subscribe({
      next: data => this.orders.set(data),
      error: () => {
        this.error.set('Could not load order history.');
      }
    });
  }

  // Add item to cart
  add(item: MenuItem): void {

    this.cart.update(cart => {

      const existing = cart.find(
        line => line.item.id === item.id
      );

      if (existing) {
        return cart.map(line =>
          line.item.id === item.id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }

      return [...cart, { item, quantity: 1 }];

    });
  }

  // Increase or decrease quantity
  change(line: CartLine, delta: number): void {

    this.cart.update(cart =>
      cart
        .map(item =>
          item.item.id === line.item.id
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  }

  // Create and save order
  placeOrder(): void {

    if (
      !this.customerName.trim() ||
      !this.customerPhone.trim() ||
      this.cart().length === 0
    ) {
      this.error.set(
        'Please enter customer details and add items.'
      );
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.lastBill.set(null);

    const orderData = {
      customer_name: this.customerName.trim(),
      customer_phone: this.customerPhone.trim(),
      items: this.cart().map(line => ({
        menu_item_id: line.item.id,
        quantity: line.quantity
      }))
    };

    this.api.createOrder(orderData).subscribe({

      next: response => {

        this.lastBill.set(response);
        this.saving.set(false);

        this.cart.set([]);

        // Refresh dashboard and order history
        this.load();
      },

      error: err => {

        this.error.set(
          err.error?.detail || 'Could not save order.'
        );

        this.saving.set(false);
      }

    });
  }

  // Permanently delete an order
  deleteOrder(orderId: string): void {

    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this order? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    this.deletingOrderId.set(orderId);
    this.error.set('');

    this.api.deleteOrder(orderId).subscribe({

      next: () => {

        this.deletingOrderId.set(null);

        // Reload orders and recalculate sales
        this.load();

      },

      error: err => {

        this.deletingOrderId.set(null);

        this.error.set(
          err.error?.detail || 'Could not delete order.'
        );

      }

    });
  }

  // Prepare bill text
  billText(): string {

    const bill = this.lastBill();

    if (!bill) {
      return '';
    }

    return (
      `Snack 'n' Sip\n` +
      `Bill: ${bill.order.id}\n` +
      `Customer: ${bill.order.customer_name}\n` +
      `Phone: ${bill.order.customer_phone}\n\n` +

      bill.items.map((item: any) =>
        `${item.item_name} x ${item.quantity} = Rs. ${item.line_total}`
      ).join('\n') +

      `\n\nTOTAL: Rs. ${bill.order.total_amount}\n` +
      `Thank you for ordering!`
    );
  }

  // Share bill on WhatsApp
  shareWhatsApp(): void {

    const phone = this.customerPhone.replace(/\D/g, '');

    if (!phone) {
      this.error.set(
        'Please enter a valid phone number with country code.'
      );
      return;
    }

    const url =
      `https://wa.me/${phone}?text=${encodeURIComponent(this.billText())}`;

    window.open(url, '_blank');
  }

  // Print bill
  printBill(): void {

    const billWindow = window.open('', '_blank');

    if (!billWindow) {
      this.error.set(
        'Please allow pop-ups to print the bill.'
      );
      return;
    }

    const safeBill = this.billText()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    billWindow.document.write(`
      <html>
        <head>
          <title>Snack 'n' Sip Bill</title>

          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 25px;
            }

            pre {
              white-space: pre-wrap;
              font-size: 15px;
            }
          </style>
        </head>

        <body>
          <pre>${safeBill}</pre>
        </body>
      </html>
    `);

    billWindow.document.close();
    billWindow.print();
  }

}
