import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
@Component({ selector: 'app-vendor', standalone: true, template: '' })
export class VendorComponent implements OnInit {
  constructor(private router: Router) {}
  ngOnInit() { this.router.navigate(['/vendor/dashboard']); }
}
