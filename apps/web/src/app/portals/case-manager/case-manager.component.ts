import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({ selector: 'app-case-manager', standalone: true, template: '' })
export class CaseManagerComponent implements OnInit {
  constructor(private router: Router) {}
  ngOnInit(): void { this.router.navigate(['/case-manager/dashboard']); }
}
