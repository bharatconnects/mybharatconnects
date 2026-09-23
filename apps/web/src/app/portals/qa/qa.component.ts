import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
@Component({ selector: 'app-qa', standalone: true, template: '' })
export class QaComponent implements OnInit {
  constructor(private router: Router) {}
  ngOnInit() { this.router.navigate(['/qa/reviews']); }
}
