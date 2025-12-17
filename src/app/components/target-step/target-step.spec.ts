import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TargetStep } from './target-step';

describe('TargetStep', () => {
  let component: TargetStep;
  let fixture: ComponentFixture<TargetStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TargetStep]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TargetStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
