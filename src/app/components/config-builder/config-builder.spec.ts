import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigBuilder } from './config-builder';

describe('ConfigBuilder', () => {
  let component: ConfigBuilder;
  let fixture: ComponentFixture<ConfigBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigBuilder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigBuilder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
