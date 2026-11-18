
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
}

export interface CartLine {
  item: MenuItem;
  quantity: number;
}

export interface SalesSummary {
  today_sales: number;
  today_orders: number;
  monthly_sales: number;
  monthly_orders: number;
  overall_sales: number;
  overall_orders: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private base = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  menu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.base}/menu`);
  }

  summary(): Observable<SalesSummary> {
    return this.http.get<SalesSummary>(
      `${this.base}/sales/summary`
    );
  }

  orders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/orders`);
  }

  createOrder(body: any): Observable<any> {
    return this.http.post(`${this.base}/orders`, body);
  }

  // Permanently delete an order.
  deleteOrder(orderId: string): Observable<any> {
    return this.http.delete(
      `${this.base}/orders/${encodeURIComponent(orderId)}`
    );
  }
}
