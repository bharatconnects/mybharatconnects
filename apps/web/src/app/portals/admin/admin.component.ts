import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
@Component({ selector: 'app-admin', standalone: true, template: '' })
export class AdminComponent implements OnInit {
  constructor(private router: Router) {}
  ngOnInit() { this.router.navigate(['/admin/dashboard']); }
}
